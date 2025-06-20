# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

class ConstructionMaterialRequest(Document):
    def validate(self):
        self.validate_dates()
        self.calculate_totals()
        self.set_title()
        self.validate_project_links()
    
    def validate_dates(self):
        """Validate transaction and required by dates"""
        if getdate(self.required_by_date) < getdate(self.transaction_date):
            frappe.throw(_("Required By Date cannot be before Transaction Date"))
    
    def calculate_totals(self):
        """Calculate total estimated cost"""
        total = 0
        for item in self.items:
            if item.quantity and item.estimated_price:
                item.estimated_amount = item.quantity * item.estimated_price
                total += item.estimated_amount
        
        self.total_estimated_cost = total
    
    def set_title(self):
        """Set the document title if not already set"""
        if not self.title:
            self.title = _("Material Request for {0}").format(
                self.construction_project or self.project or "General Purpose"
            )
    
    def validate_project_links(self):
        """Validate project links"""
        if self.construction_project and not self.project:
            # Try to fetch the linked ERPNext project
            construction_project = frappe.get_doc("Construction Project", self.construction_project)
            if construction_project.erpnext_project:
                self.project = construction_project.erpnext_project
    
    def on_submit(self):
        """Actions on document submission"""
        self.update_status("Submitted")
    
    def on_cancel(self):
        """Actions on document cancellation"""
        self.update_status("Cancelled")
    
    def update_status(self, status):
        """Update the document status"""
        if self.status != status:
            self.db_set('status', status, update_modified=True)
    
    @frappe.whitelist()
    def approve(self, approved_by=None, approval_date=None):
        """Approve the material request"""
        if not self.has_permission("write"):
            frappe.throw(_("Not permitted"), frappe.PermissionError)
        
        self.db_set('approval_status', 'Approved')
        self.db_set('approved_by', approved_by or frappe.session.user)
        self.db_set('approval_date', approval_date or nowdate())
        self.update_status("Approved")
        
        return True
    
    @frappe.whitelist()
    def reject(self, rejection_reason):
        """Reject the material request"""
        if not self.has_permission("write"):
            frappe.throw(_("Not permitted"), frappe.PermissionError)
        
        if not rejection_reason:
            frappe.throw(_("Rejection Reason is required"))
        
        self.db_set('approval_status', 'Rejected')
        self.db_set('rejection_reason', rejection_reason)
        self.update_status("Rejected")
        
        return True
    
    @frappe.whitelist()
    def create_material_request(self):
        """Create an ERPNext Material Request from this document"""
        if not self.has_permission("write"):
            frappe.throw(_("Not permitted"), frappe.PermissionError)
        
        if self.approval_status != "Approved":
            frappe.throw(_("Cannot create Material Request until this document is approved"))
        
        # Check if any items have linked ERPNext Items
        has_items = False
        for item in self.items:
            if item.item:
                has_items = True
                break
        
        if not has_items:
            frappe.throw(_("None of the materials have linked ERPNext Items. Please link materials to Items first."))
        
        # Create Material Request
        mr = frappe.new_doc("Material Request")
        mr.material_request_type = "Purchase"
        mr.transaction_date = self.transaction_date
        mr.schedule_date = self.required_by_date
        mr.set_warehouse = ""
        
        # Set project if available
        if self.project:
            mr.project = self.project
        
        # Add items
        for item in self.items:
            if item.item:
                mr.append("items", {
                    "item_code": item.item,
                    "item_name": item.item_name,
                    "description": item.description,
                    "qty": item.quantity,
                    "uom": item.uom,
                    "warehouse": item.warehouse,
                    "schedule_date": item.schedule_date or self.required_by_date,
                    "construction_material_request": self.name,
                    "construction_material_request_item": item.name
                })
        
        if not mr.items:
            frappe.throw(_("No valid items found to create Material Request"))
        
        # Save and submit the Material Request
        mr.insert(ignore_permissions=True)
        mr.submit()
        
        # Update status
        self.update_status("Ordered")
        
        return mr.name