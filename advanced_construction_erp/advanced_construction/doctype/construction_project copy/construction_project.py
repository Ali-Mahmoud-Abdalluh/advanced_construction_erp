from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname
from frappe.utils import getdate, add_days, cint, nowdate

class ConstructionProject(Document):
    def autoname(self):
        self.name = make_autoname(self.project + "/.####")

    def validate(self):
        self.validate_dates()
        self.validate_budget()
        self.update_project_status()

    def validate_dates(self):
        if getdate(self.expected_start_date) > getdate(self.expected_end_date):
            frappe.throw(_("Expected Start Date cannot be after Expected End Date"))

    def validate_budget(self):
        if self.total_budget and self.total_budget < 0:
            frappe.throw(_("Total Budget cannot be negative"))

    def update_project_status(self):
        if self.status == "Completed":
            self.completion_date = getdate()
            self.actual_end_date = getdate()
        elif self.status == "In Progress":
            self.actual_start_date = getdate()

    def on_submit(self):
        self.create_project_tasks()
        self.create_initial_budget()

    def on_cancel(self):
        self.cancel_related_documents()

    def create_project_tasks(self):
        if not self.project_tasks:
            default_tasks = [
                "Site Preparation",
                "Foundation Work",
                "Structural Work",
                "MEP Installation",
                "Interior Work",
                "Exterior Work",
                "Finishing Work"
            ]
            
            for task in default_tasks:
                self.append("project_tasks", {
                    "task_name": task,
                    "status": "Not Started"
                })

    def create_initial_budget(self):
        if not self.budget_items:
            frappe.throw(_("Please add budget items before submitting"))

    def cancel_related_documents(self):
        # Cancel related documents like purchase orders, work orders, etc.
        pass

    def get_progress(self):
        if not self.project_tasks:
            return 0
        
        completed_tasks = len([task for task in self.project_tasks if task.status == "Completed"])
        total_tasks = len(self.project_tasks)
        
        return (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0

    def update_costs(self):
        # Update actual costs from related documents
        pass

    def get_earned_value(self):
        # Calculate earned value based on progress and budget
        pass

    def get_schedule_variance(self):
        # Calculate schedule variance
        pass

    def get_cost_variance(self):
        # Calculate cost variance
        pass

@frappe.whitelist()
def get_project_status(project):
    return frappe.get_doc("Construction Project", project).status

@frappe.whitelist()
def update_project_progress(project):
    doc = frappe.get_doc("Construction Project", project)
    doc.progress = doc.get_progress()
    doc.save()
    return doc.progress

def has_permission(doc, user=None, permission_type=None):
    """Check if user has permission for the Construction Project"""
    if user == "Administrator":
        return True
    
    if permission_type == "read":
        # Allow read access to all users with Construction User role
        if frappe.has_permission("Construction Project", user=user, ptype="read"):
            return True
    
    # For other permission types, check if user is project manager or has Construction Manager role
    if doc.project_manager == user or frappe.has_permission("Construction Project", user=user, ptype=permission_type):
        return True
    
    return False

def update_project_status():
    """Daily scheduled task to update project status based on dates and progress"""
    today = nowdate()
    
    # Find projects that should be started
    projects_to_start = frappe.get_all(
        "Construction Project",
        filters={
            "status": "Not Started",
            "expected_start_date": ("<=", today)
        },
        fields=["name"]
    )
    
    for project in projects_to_start:
        doc = frappe.get_doc("Construction Project", project.name)
        doc.status = "In Progress"
        doc.actual_start_date = today
        doc.save()
        
    # Find projects that should be completed
    projects_to_complete = frappe.get_all(
        "Construction Project",
        filters={
            "status": "In Progress",
            "expected_end_date": ("<=", today),
            "progress": (">=", 95)
        },
        fields=["name"]
    )
    
    for project in projects_to_complete:
        doc = frappe.get_doc("Construction Project", project.name)
        doc.status = "Completed"
        doc.actual_end_date = today
        doc.completion_date = today
        doc.save()

def generate_weekly_reports():
    """Weekly scheduled task to generate project status reports"""
    from datetime import datetime
    
    # Get all active projects
    active_projects = frappe.get_all(
        "Construction Project",
        filters={
            "status": ["in", ["Not Started", "In Progress"]]
        },
        fields=["name", "project_name", "progress", "expected_start_date", "expected_end_date"]
    )
    
    # Create weekly report
    report = frappe.new_doc("Construction Project Status")
    report.report_date = nowdate()
    report.report_name = f"Weekly Status Report - {datetime.now().strftime('%Y-%m-%d')}"
    
    for project in active_projects:
        report.append("projects", {
            "project": project.name,
            "project_name": project.project_name,
            "progress": project.progress,
            "expected_start_date": project.expected_start_date,
            "expected_end_date": project.expected_end_date
        })
    
    report.insert()
    return report.name 