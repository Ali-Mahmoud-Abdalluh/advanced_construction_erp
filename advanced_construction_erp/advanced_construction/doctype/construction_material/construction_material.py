# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document

class ConstructionMaterial(Document):
    def validate(self):
        self.validate_fixed_asset_settings()
        self.validate_stock_item_settings()
    
    def validate_fixed_asset_settings(self):
        """Validate settings for fixed assets"""
        if self.is_fixed_asset:
            if not self.asset_category:
                frappe.throw(_("Asset Category is required for Fixed Assets"))
    
    def validate_stock_item_settings(self):
        """Validate settings for stock items"""
        if self.is_stock_item:
            if not self.default_warehouse:
                frappe.msgprint(_("Default Warehouse is recommended for Stock Items"))
    
    def before_save(self):
        """Before save operations"""
        self.sync_with_item()
    
    def sync_with_item(self):
        """Sync with ERPNext Item if linked"""
        if self.item:
            # Get the Item document
            item = frappe.get_doc("Item", self.item)
            
            # Update the Item with Construction Material data
            update_needed = False
            
            if item.item_name != self.material_name:
                item.item_name = self.material_name
                update_needed = True
            
            if item.description != self.description:
                item.description = self.description
                update_needed = True
            
            if item.disabled != self.disabled:
                item.disabled = self.disabled
                update_needed = True
            
            if item.is_stock_item != self.is_stock_item:
                item.is_stock_item = self.is_stock_item
                update_needed = True
            
            if item.stock_uom != self.unit_of_measure:
                item.stock_uom = self.unit_of_measure
                update_needed = True
            
            if update_needed:
                item.flags.ignore_validate = True
                item.flags.ignore_mandatory = True
                item.save(ignore_permissions=True)
                frappe.msgprint(_("ERPNext Item {0} has been updated").format(self.item))
    
    def on_trash(self):
        """Before delete operations"""
        # Check if this material is used in any other documents
        self.check_if_used_in_transactions()
    
    def check_if_used_in_transactions(self):
        """Check if material is used in any transactions"""
        # This is a placeholder for actual implementation
        # In a real scenario, you would check various doctypes that might reference this material
        pass
    
    @frappe.whitelist()
    def create_item(self):
        """Create an ERPNext Item from this Construction Material"""
        if self.item:
            frappe.throw(_("This Construction Material is already linked to Item {0}").format(self.item))
        
        # Create a new Item
        item = frappe.new_doc("Item")
        item.item_code = self.material_code
        item.item_name = self.material_name
        item.item_group = "Construction Materials"
        item.description = self.description
        item.stock_uom = self.unit_of_measure
        item.is_stock_item = self.is_stock_item
        item.disabled = self.disabled
        item.brand = self.brand
        item.country_of_origin = self.country_of_origin
        item.standard_rate = self.standard_rate
        
        # Set default warehouse if specified
        if self.default_warehouse:
            item.append("item_defaults", {
                "default_warehouse": self.default_warehouse
            })
        
        # Save the item
        item.insert(ignore_permissions=True)
        
        # Update the Construction Material with the Item reference
        self.item = item.name
        self.save(ignore_permissions=True)
        
        frappe.msgprint(_("Item {0} has been created").format(item.name))
        
        return item.name