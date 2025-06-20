# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

class NonConformanceReport(Document):
    def validate(self):
        self.validate_dates()
        self.validate_issues()
        self.validate_actions()
        self.update_status()
    
    def validate_dates(self):
        """Validate dates"""
        today = getdate(nowdate())
        
        # Validate identification date
        if self.date_identified and getdate(self.date_identified) > today:
            frappe.throw(_("Date Identified cannot be in the future"))
        
        # Validate verification date
        if self.verification_date and getdate(self.verification_date) > today:
            frappe.throw(_("Verification Date cannot be in the future"))
        
        # Validate action due dates
        if self.corrective_actions:
            for action in self.corrective_actions:
                if action.completion_date and action.due_date and getdate(action.completion_date) < getdate(action.due_date):
                    frappe.msgprint(_("Completion date for action '{0}' is before its due date").format(action.action_description))
        
        if self.preventive_actions:
            for action in self.preventive_actions:
                if action.completion_date and action.due_date and getdate(action.completion_date) < getdate(action.due_date):
                    frappe.msgprint(_("Completion date for action '{0}' is before its due date").format(action.action_description))
    
    def validate_issues(self):
        """Validate issues"""
        if not self.issues or len(self.issues) == 0:
            frappe.throw(_("At least one issue is required"))
    
    def validate_actions(self):
        """Validate actions"""
        if self.status in ["Action Plan Created", "Corrective Action Completed", "Verified", "Closed"]:
            if not self.corrective_actions or len(self.corrective_actions) == 0:
                frappe.throw(_("At least one corrective action is required for the current status"))
        
        # Check if all actions are completed for status "Corrective Action Completed"
        if self.status == "Corrective Action Completed":
            if self.corrective_actions:
                incomplete_actions = [a for a in self.corrective_actions if a.status != "Completed"]
                if incomplete_actions:
                    frappe.throw(_("All corrective actions must be completed for status 'Corrective Action Completed'"))
    
    def update_status(self):
        """Update status based on actions and verification"""
        # Don't auto-update if status is Cancelled or Closed
        if self.status in ["Cancelled", "Closed"]:
            return
        
        # Update status based on root cause
        if self.root_cause and self.status == "Open":
            self.status = "Root Cause Identified"
        
        # Update status based on actions
        if self.corrective_actions and len(self.corrective_actions) > 0 and self.status in ["Open", "Root Cause Identified"]:
            self.status = "Action Plan Created"
        
        # Check if all corrective actions are completed
        if self.corrective_actions and len(self.corrective_actions) > 0:
            all_completed = all(action.status == "Completed" for action in self.corrective_actions)
            if all_completed and self.status == "Action Plan Created":
                self.status = "Corrective Action Completed"
        
        # Update status based on verification
        if self.verification_result == "Passed" and self.status == "Corrective Action Completed":
            self.status = "Verified"
    
    def on_submit(self):
        """Actions on submit"""
        # Create tasks for actions
        self.create_action_tasks()
        
        # Update linked inspection
        if self.inspection:
            inspection = frappe.get_doc("Quality Inspection", self.inspection)
            inspection.ncr_created = 1
            inspection.ncr = self.name
            inspection.save()
    
    def create_action_tasks(self):
        """Create tasks for corrective and preventive actions"""
        if not self.project:
            return
            
        # Create tasks for corrective actions
        if self.corrective_actions:
            for action in self.corrective_actions:
                self.create_task(action, "Corrective")
        
        # Create tasks for preventive actions
        if self.preventive_actions:
            for action in self.preventive_actions:
                self.create_task(action, "Preventive")
    
    def create_task(self, action, action_type):
        """Create a task for an action"""
        task = frappe.new_doc("Task")
        task.subject = f"{action_type} Action: {action.action_description[:50]}"
        task.description = action.action_description
        task.project = self.project
        task.expected_start_date = nowdate()
        task.expected_end_date = action.due_date
        task.status = "Open"
        task.priority = "High" if self.severity in ["High", "Critical"] else "Medium"
        task.reference_type = "Non Conformance Report"
        task.reference_name = self.name
        
        # Assign to user
        if action.assigned_to:
            task._assign = action.assigned_to
        
        task.insert()
        
        # Link task to action
        action.task = task.name
        action.db_update()
        
        frappe.msgprint(_("Task {0} created for action").format(task.name))
    
    def update_action_status(self):
        """Update action status based on linked tasks"""
        # Update corrective actions
        if self.corrective_actions:
            for action in self.corrective_actions:
                if action.task:
                    task = frappe.get_doc("Task", action.task)
                    if task.status == "Completed" and action.status != "Completed":
                        action.status = "Completed"
                        action.completion_date = task.completed_on
                        action.db_update()
        
        # Update preventive actions
        if self.preventive_actions:
            for action in self.preventive_actions:
                if action.task:
                    task = frappe.get_doc("Task", action.task)
                    if task.status == "Completed" and action.status != "Completed":
                        action.status = "Completed"
                        action.completion_date = task.completed_on
                        action.db_update()
        
        # Update NCR status
        self.update_status()
        self.save()
    
    @frappe.whitelist()
    def verify_actions(self):
        """Mark actions as verified"""
        if not self.verified_by:
            self.verified_by = frappe.session.user
        
        if not self.verification_date:
            self.verification_date = nowdate()
        
        if not self.verification_result:
            self.verification_result = "Passed"
        
        if self.verification_result == "Passed":
            self.status = "Verified"
        
        return self 