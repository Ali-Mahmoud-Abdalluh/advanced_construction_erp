# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

class QualityChecklist(Document):
    def validate(self):
        self.validate_dates()
        self.validate_items()
        self.set_defaults()
    
    def validate_dates(self):
        """Validate effective and expiry dates"""
        if self.effective_date and getdate(self.effective_date) > getdate(nowdate()):
            frappe.msgprint(_("Effective Date is in the future"), alert=True)
        
        if self.effective_date and self.expiry_date and getdate(self.expiry_date) < getdate(self.effective_date):
            frappe.throw(_("Expiry Date cannot be before Effective Date"))
    
    def validate_items(self):
        """Validate checklist items"""
        if not self.items or len(self.items) == 0:
            frappe.throw(_("At least one checklist item is required"))
        
        # Ensure all items have sequence numbers
        for i, item in enumerate(self.items):
            if not item.sequence:
                item.sequence = i + 1
    
    def set_defaults(self):
        """Set default values"""
        if not self.creation_date:
            self.creation_date = nowdate()
        
        if not self.created_by:
            self.created_by = frappe.session.user
    
    def on_submit(self):
        """Actions on submit"""
        # If this is a new version of an existing checklist, mark the old one as obsolete
        if self.version != "1.0" and self.status == "Active":
            # Find previous versions of this checklist
            prev_versions = frappe.get_all("Quality Checklist", 
                filters={
                    "checklist_name": self.checklist_name,
                    "version": ["<", self.version],
                    "status": "Active"
                })
            
            # Mark previous versions as obsolete
            for prev in prev_versions:
                prev_doc = frappe.get_doc("Quality Checklist", prev.name)
                prev_doc.status = "Obsolete"
                prev_doc.save()
                frappe.msgprint(_("Previous version {0} marked as Obsolete").format(prev_doc.version))
    
    @frappe.whitelist()
    def create_new_version(self):
        """Create a new version of this checklist"""
        if self.status == "Obsolete":
            frappe.throw(_("Cannot create new version from an obsolete checklist"))
        
        # Parse current version and increment
        try:
            major, minor = self.version.split(".")
            new_version = f"{major}.{int(minor) + 1}"
        except:
            new_version = f"{self.version}.1"
        
        # Create new checklist
        new_checklist = frappe.copy_doc(self)
        new_checklist.version = new_version
        new_checklist.status = "Draft"
        new_checklist.creation_date = nowdate()
        new_checklist.created_by = frappe.session.user
        new_checklist.approved_by = ""
        new_checklist.approval_date = None
        
        return new_checklist
    
    @frappe.whitelist()
    def copy_to_inspection(self):
        """Create a new quality inspection from this checklist"""
        inspection = frappe.new_doc("Quality Inspection")
        inspection.inspection_type = self.checklist_type
        inspection.quality_checklist = self.name
        inspection.status = "Draft"
        inspection.inspection_date = nowdate()
        
        # Copy checklist items
        for item in self.items:
            inspection.append("checklist_items", {
                "check_name": item.check_name,
                "specification": item.specification,
                "inspection_method": item.inspection_method,
                "expected_value": item.expected_value,
                "acceptance_criteria": item.acceptance_criteria,
                "is_critical": item.is_critical,
                "status": "Pending"
            })
        
        return inspection 