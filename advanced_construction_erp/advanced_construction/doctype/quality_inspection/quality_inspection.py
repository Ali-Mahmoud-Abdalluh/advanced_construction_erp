# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

class QualityInspection(Document):
    def validate(self):
        self.validate_dates()
        self.validate_checklist_items()
        self.calculate_results()
        self.update_status()
    
    def validate_dates(self):
        """Validate inspection date"""
        if self.inspection_date and getdate(self.inspection_date) > getdate(nowdate()):
            frappe.msgprint(_("Inspection Date cannot be in the future"), alert=True)
    
    def validate_checklist_items(self):
        """Validate checklist items"""
        if not self.checklist_items or len(self.checklist_items) == 0:
            frappe.throw(_("At least one checklist item is required"))
        
        # Ensure all checklist items have a status
        for item in self.checklist_items:
            if not item.status:
                frappe.throw(_("Status is required for all checklist items"))
    
    def calculate_results(self):
        """Calculate inspection results"""
        if not self.checklist_items:
            return
            
        total = len(self.checklist_items)
        passed = len([item for item in self.checklist_items if item.status == "Pass"])
        failed = len([item for item in self.checklist_items if item.status == "Fail"])
        na = len([item for item in self.checklist_items if item.status == "Not Applicable"])
        
        self.total_checks = total
        self.passed_checks = passed
        self.failed_checks = failed
        
        # Calculate quality score (excluding N/A items)
        applicable_items = total - na
        if applicable_items > 0:
            self.quality_score = (passed / applicable_items) * 100
        else:
            self.quality_score = 0
    
    def update_status(self):
        """Update inspection status based on results"""
        if self.status == "Draft":
            return
            
        if self.status == "Inspection Completed" and self.checklist_items:
            # Check if any critical items failed
            critical_failures = any(item.status == "Fail" and item.is_critical for item in self.checklist_items)
            
            if critical_failures:
                self.status = "Rejected"
                frappe.msgprint(_("Inspection rejected due to critical item failure"))
            elif self.quality_score >= 90:
                self.status = "Approved"
                frappe.msgprint(_("Inspection approved with quality score of {0}%").format(round(self.quality_score, 2)))
            elif self.failed_checks > 0:
                self.status = "Rejected"
                frappe.msgprint(_("Inspection rejected with quality score of {0}%").format(round(self.quality_score, 2)))
    
    def on_submit(self):
        """Actions on submit"""
        # Update reference document if applicable
        if self.reference_type and self.reference_name:
            self.update_reference_document()
        
        # Create non-conformance report if rejected
        if self.status == "Rejected":
            self.create_nonconformance_report()
    
    def update_reference_document(self):
        """Update the reference document with inspection results"""
        if not self.reference_type or not self.reference_name:
            return
            
        try:
            # Check if reference document exists
            if not frappe.db.exists(self.reference_type, self.reference_name):
                return
                
            ref_doc = frappe.get_doc(self.reference_type, self.reference_name)
            
            # Update reference document based on type
            if self.reference_type == "Purchase Receipt":
                # Update item quality inspection status
                for item in ref_doc.items:
                    if item.item_code == self.item_code:
                        item.quality_inspection = self.name
                        item.qa_status = self.status
                ref_doc.save()
                frappe.msgprint(_("Updated Purchase Receipt with inspection results"))
                
            elif self.reference_type == "Task":
                # Update task status based on inspection
                if self.status == "Approved":
                    ref_doc.status = "Completed"
                elif self.status == "Rejected":
                    ref_doc.status = "Failed QC"
                ref_doc.quality_inspection = self.name
                ref_doc.save()
                frappe.msgprint(_("Updated Task with inspection results"))
                
        except Exception as e:
            frappe.msgprint(_("Could not update reference document: {0}").format(str(e)))
    
    def create_nonconformance_report(self):
        """Create non-conformance report if inspection is rejected"""
        if self.status != "Rejected":
            return
            
        try:
            # Check if Non-Conformance Report doctype exists
            if not frappe.db.exists("DocType", "Non Conformance Report"):
                return
                
            # Create non-conformance report
            ncr = frappe.new_doc("Non Conformance Report")
            ncr.inspection = self.name
            ncr.project = self.project
            ncr.reference_type = self.reference_type
            ncr.reference_name = self.reference_name
            ncr.item_code = self.item_code
            ncr.date_identified = self.inspection_date
            ncr.identified_by = self.inspector
            
            # Add failed items
            for item in self.checklist_items:
                if item.status == "Fail":
                    ncr.append("issues", {
                        "issue_description": item.check_name,
                        "specification": item.specification,
                        "actual_value": item.actual_value,
                        "expected_value": item.expected_value,
                        "is_critical": item.is_critical
                    })
            
            ncr.insert()
            frappe.msgprint(_("Non-Conformance Report {0} created").format(ncr.name))
            
        except Exception as e:
            frappe.msgprint(_("Could not create Non-Conformance Report: {0}").format(str(e)))
    
    def get_inspection_summary(self):
        """Get inspection summary for dashboard"""
        return {
            "total": self.total_checks,
            "passed": self.passed_checks,
            "failed": self.failed_checks,
            "quality_score": self.quality_score,
            "critical_failures": len([item for item in self.checklist_items if item.status == "Fail" and item.is_critical]) if self.checklist_items else 0
        }
    
    @frappe.whitelist()
    def copy_from_checklist(self, checklist):
        """Copy items from a quality checklist"""
        if not checklist:
            frappe.throw(_("Please select a checklist"))
            
        # Get checklist
        checklist_doc = frappe.get_doc("Quality Checklist", checklist)
        
        # Clear existing items
        self.checklist_items = []
        
        # Copy items from checklist
        for item in checklist_doc.items:
            self.append("checklist_items", {
                "check_name": item.check_name,
                "specification": item.specification,
                "inspection_method": item.inspection_method,
                "expected_value": item.expected_value,
                "acceptance_criteria": item.acceptance_criteria,
                "is_critical": item.is_critical,
                "status": "Pending"
            })
        
        return self.checklist_items 