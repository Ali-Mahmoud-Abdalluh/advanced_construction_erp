# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, flt, add_days, add_months, nowdate

class ContractManagement(Document):
    def validate(self):
        self.validate_dates()
        self.validate_contract_value()
        self.validate_milestones()
        self.update_status()
    
    def validate_dates(self):
        """Validate that end date is after start date"""
        if self.start_date and self.end_date:
            if getdate(self.end_date) < getdate(self.start_date):
                frappe.throw(_("End Date cannot be before Start Date"))
    
    def validate_contract_value(self):
        """Validate contract value and milestone payments"""
        if self.contract_value and self.milestones:
            total_milestone_payment = sum(flt(milestone.payment_amount) for milestone in self.milestones)
            
            if flt(total_milestone_payment) > flt(self.contract_value):
                frappe.throw(_("Total milestone payments ({0}) cannot exceed contract value ({1})").format(
                    total_milestone_payment, self.contract_value))
            
            # Check if total milestone payment percentage adds up to 100%
            total_percentage = sum(flt(milestone.payment_percentage) for milestone in self.milestones)
            if total_percentage > 100:
                frappe.msgprint(_("Total milestone payment percentage ({0}%) exceeds 100%").format(total_percentage))
    
    def validate_milestones(self):
        """Validate milestone dates and payment amounts"""
        for milestone in self.milestones:
            # Ensure milestone due date is within contract period
            if milestone.due_date and getdate(milestone.due_date) < getdate(self.start_date):
                frappe.throw(_("Milestone '{0}' due date cannot be before contract start date").format(milestone.milestone_name))
            
            if milestone.due_date and getdate(milestone.due_date) > getdate(self.end_date):
                frappe.msgprint(_("Milestone '{0}' due date is after contract end date").format(milestone.milestone_name))
            
            # Calculate payment amount if percentage is provided
            if milestone.payment_percentage and not milestone.payment_amount:
                milestone.payment_amount = flt(self.contract_value) * flt(milestone.payment_percentage) / 100
            
            # Calculate percentage if amount is provided
            if milestone.payment_amount and not milestone.payment_percentage and flt(self.contract_value) > 0:
                milestone.payment_percentage = flt(milestone.payment_amount) / flt(self.contract_value) * 100
    
    def update_status(self):
        """Update contract status based on dates"""
        today = getdate(nowdate())
        
        if self.status == "Draft":
            return
        
        if getdate(self.start_date) > today:
            # Contract hasn't started yet
            if self.status != "Active":
                self.status = "Active"
                frappe.msgprint(_("Contract status updated to 'Active'"))
        
        if getdate(self.end_date) < today:
            # Contract has ended
            if self.status != "Completed":
                self.status = "Completed"
                frappe.msgprint(_("Contract status updated to 'Completed'"))
    
    def on_submit(self):
        """Actions when contract is submitted"""
        # Create project if it doesn't exist
        if not frappe.db.exists("Project", {"construction_contract": self.name}):
            self.create_project()
        
        # Create tasks for milestones
        self.create_milestone_tasks()
    
    def create_project(self):
        """Create a project from this contract"""
        if not self.project:
            project = frappe.new_doc("Project")
            project.project_name = f"Contract - {self.contract_number}"
            project.construction_contract = self.name
            project.customer = self.client
            project.expected_start_date = self.start_date
            project.expected_end_date = self.end_date
            project.status = "Open"
            project.insert()
            
            self.project = project.name
            self.db_update()
            
            frappe.msgprint(_("Project {0} created from contract").format(project.name))
    
    def create_milestone_tasks(self):
        """Create tasks for contract milestones"""
        if not self.project:
            return
            
        for milestone in self.milestones:
            task = frappe.new_doc("Task")
            task.subject = milestone.milestone_name
            task.description = milestone.description
            task.project = self.project
            task.expected_start_date = add_days(milestone.due_date, -30)  # Start 30 days before due date
            task.expected_end_date = milestone.due_date
            task.status = "Open"
            task.milestone = 1  # Mark as milestone task
            task.insert()
            
            # Link the task to the milestone
            milestone.task = task.name
            milestone.db_update()
    
    def get_payment_schedule(self):
        """Get payment schedule based on milestones"""
        payment_schedule = []
        
        for milestone in self.milestones:
            payment_schedule.append({
                "milestone": milestone.milestone_name,
                "due_date": milestone.due_date,
                "amount": milestone.payment_amount,
                "percentage": milestone.payment_percentage,
                "status": milestone.payment_status
            })
        
        return payment_schedule
    
    def get_contract_summary(self):
        """Get contract summary for dashboard"""
        total_milestones = len(self.milestones) if self.milestones else 0
        completed_milestones = len([m for m in self.milestones if m.status == "Completed"]) if self.milestones else 0
        
        # Calculate days remaining
        today = getdate(nowdate())
        end_date = getdate(self.end_date)
        days_remaining = (end_date - today).days if end_date > today else 0
        
        # Calculate payment status
        total_payment = self.contract_value
        paid_amount = sum(flt(m.payment_amount) for m in self.milestones if m.payment_status == "Paid") if self.milestones else 0
        payment_percentage = (paid_amount / total_payment * 100) if total_payment > 0 else 0
        
        return {
            "total_milestones": total_milestones,
            "completed_milestones": completed_milestones,
            "milestone_progress": (completed_milestones / total_milestones * 100) if total_milestones > 0 else 0,
            "days_remaining": days_remaining,
            "paid_amount": paid_amount,
            "payment_percentage": payment_percentage
        }
    
    def create_invoice(self, milestone):
        """Create sales invoice for a milestone"""
        if not milestone or not milestone.milestone_name:
            frappe.throw(_("Please select a valid milestone"))
            
        if milestone.payment_status == "Paid":
            frappe.throw(_("Invoice already paid for milestone {0}").format(milestone.milestone_name))
            
        # Create a sales invoice
        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = self.client
        invoice.project = self.project
        invoice.construction_contract = self.name
        invoice.contract_milestone = milestone.name
        invoice.due_date = add_days(nowdate(), 30)  # Due in 30 days
        
        # Add invoice item
        invoice.append("items", {
            "item_code": "Construction Service",  # This should be a valid item code in your system
            "qty": 1,
            "rate": milestone.payment_amount,
            "amount": milestone.payment_amount,
            "description": f"Payment for milestone: {milestone.milestone_name}"
        })
        
        invoice.insert()
        
        # Update milestone status
        milestone.payment_status = "Invoiced"
        milestone.db_update()
        
        return invoice.name 