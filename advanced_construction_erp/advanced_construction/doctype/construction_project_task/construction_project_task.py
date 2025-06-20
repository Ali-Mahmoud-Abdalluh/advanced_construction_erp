from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, date_diff, add_days, flt, nowdate

class ConstructionProjectTask(Document):
    def validate(self):
        self.validate_dates()
        self.validate_dependencies()
        self.update_task_progress()
        self.calculate_duration()
        self.calculate_resource_cost()
        self.check_critical_path()

    def validate_dates(self):
        if self.start_date and self.end_date and getdate(self.start_date) > getdate(self.end_date):
            frappe.throw(_("Start Date cannot be after End Date"))
            
        # Check if task dates are within project dates
        if self.parent and self.parenttype == "Construction Project":
            project = frappe.get_doc("Construction Project", self.parent)
            if project.expected_start_date and self.start_date and getdate(self.start_date) < getdate(project.expected_start_date):
                frappe.msgprint(_("Task start date is before project start date"), alert=True)
            if project.expected_end_date and self.end_date and getdate(self.end_date) > getdate(project.expected_end_date):
                frappe.msgprint(_("Task end date is after project end date"), alert=True)

    def validate_dependencies(self):
        """Validate task dependencies to prevent circular references and ensure proper date sequencing"""
        if self.depends_on:
            # Check for circular dependencies
            self.check_circular_dependency()
            
            # Ensure start date is after all dependent tasks' end dates
            dependent_tasks = frappe.get_all("Construction Project Task", 
                filters={"name": ["in", self.depends_on.split(",")]},
                fields=["name", "end_date"]
            )
            
            latest_end_date = None
            for task in dependent_tasks:
                if task.end_date:
                    if not latest_end_date or getdate(task.end_date) > getdate(latest_end_date):
                        latest_end_date = task.end_date
            
            if latest_end_date and self.start_date and getdate(self.start_date) < getdate(latest_end_date):
                frappe.throw(_("Task cannot start before its dependencies are completed. Earliest possible start date is {0}").format(latest_end_date))

    def check_circular_dependency(self):
        """Check for circular dependencies in task dependencies"""
        if not self.depends_on:
            return
            
        visited = set()
        path = []
        
        def dfs(task_name):
            if task_name in path:
                path.append(task_name)
                frappe.throw(_("Circular dependency detected: {0}").format(" -> ".join(path)))
                
            if task_name in visited:
                return
                
            visited.add(task_name)
            path.append(task_name)
            
            task = frappe.get_doc("Construction Project Task", task_name)
            if task.depends_on:
                for dep in task.depends_on.split(","):
                    dfs(dep.strip())
                    
            path.pop()
            
        dfs(self.name)

    def update_task_progress(self):
        if self.status == "Completed":
            self.progress = 100
            self.actual_end_date = self.actual_end_date or nowdate()
        elif self.status == "In Progress":
            if not self.progress:
                self.progress = 0
            self.actual_start_date = self.actual_start_date or nowdate()
        elif self.status == "Not Started":
            self.progress = 0
            self.actual_start_date = None
            self.actual_end_date = None

    def calculate_duration(self):
        """Calculate task duration in days"""
        if self.start_date and self.end_date:
            self.duration = date_diff(self.end_date, self.start_date) + 1  # inclusive of start and end dates
        
        if self.actual_start_date and self.actual_end_date:
            self.actual_duration = date_diff(self.actual_end_date, self.actual_start_date) + 1
            
            if self.duration:
                self.duration_variance = self.actual_duration - self.duration

    def calculate_resource_cost(self):
        """Calculate the cost of resources assigned to this task"""
        self.labor_cost = flt(self.labor_cost) or 0
        self.material_cost = flt(self.material_cost) or 0
        self.equipment_cost = flt(self.equipment_cost) or 0
        self.subcontract_cost = flt(self.subcontract_cost) or 0
        
        self.total_cost = (
            self.labor_cost + 
            self.material_cost + 
            self.equipment_cost + 
            self.subcontract_cost
        )

    def check_critical_path(self):
        """Check if this task is on the critical path"""
        if not self.parent or self.parenttype != "Construction Project":
            return
            
        # A task is on the critical path if it has zero float
        # Float = Latest Start Date - Earliest Start Date
        # For simplicity, we'll consider tasks with dependencies or dependents as critical
        has_dependencies = self.depends_on and len(self.depends_on.split(",")) > 0
        
        # Check if other tasks depend on this task
        has_dependents = frappe.db.exists("Construction Project Task", {
            "parent": self.parent,
            "parenttype": "Construction Project",
            "depends_on": ["like", f"%{self.name}%"]
        })
        
        self.is_critical_path = 1 if (has_dependencies or has_dependents) else 0

    def on_update(self):
        self.update_project_progress()
        self.update_dependent_tasks()

    def update_project_progress(self):
        if self.parent and self.parenttype == "Construction Project":
            project = frappe.get_doc("Construction Project", self.parent)
            project.progress = project.get_progress()
            project.save()

    def update_dependent_tasks(self):
        """Update tasks that depend on this task"""
        if self.status == "Completed" and self.actual_end_date:
            # Find tasks that depend on this task
            dependent_tasks = frappe.get_all("Construction Project Task", 
                filters={
                    "parent": self.parent,
                    "parenttype": "Construction Project",
                    "depends_on": ["like", f"%{self.name}%"]
                },
                fields=["name"]
            )
            
            for task in dependent_tasks:
                dependent_task = frappe.get_doc("Construction Project Task", task.name)
                # Check if all dependencies are completed
                all_completed = True
                if dependent_task.depends_on:
                    for dep in dependent_task.depends_on.split(","):
                        dep_task = frappe.get_doc("Construction Project Task", dep.strip())
                        if dep_task.status != "Completed":
                            all_completed = False
                            break
                
                if all_completed:
                    # Suggest updating the start date
                    suggested_start_date = add_days(self.actual_end_date, 1)
                    if not dependent_task.actual_start_date and (not dependent_task.start_date or getdate(dependent_task.start_date) < getdate(suggested_start_date)):
                        frappe.msgprint(_("Task '{0}' can now start. Suggested start date: {1}").format(
                            dependent_task.task_name, suggested_start_date
                        ))

    def on_trash(self):
        self.update_project_progress()
        
    def get_time_variance(self):
        """Calculate schedule variance in days"""
        if not self.actual_start_date or not self.start_date:
            return 0
            
        start_variance = date_diff(self.actual_start_date, self.start_date)
        
        if self.actual_end_date and self.end_date:
            end_variance = date_diff(self.actual_end_date, self.end_date)
            return (start_variance + end_variance) / 2
        
        return start_variance 