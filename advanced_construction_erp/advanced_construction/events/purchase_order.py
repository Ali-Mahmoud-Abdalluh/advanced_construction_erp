# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def validate_purchase_order(doc, method):
    """
    Handler for Purchase Order document validate event
    
    Args:
        doc: The Purchase Order document being validated
        method: The method being called
    """
    # Check if this Purchase Order is linked to a Construction Project
    if doc.construction_project:
        # Validate that the items in the Purchase Order are allowed for the project
        validate_items_for_project(doc, doc.construction_project)

def on_purchase_order_submit(doc, method):
    """
    Handler for Purchase Order document on_submit event
    
    Args:
        doc: The Purchase Order document being submitted
        method: The method being called
    """
    # Check if this Purchase Order is linked to a Construction Project
    if doc.project:
        # Check if there's a Construction Project linked to this Project
        construction_project = frappe.db.get_value("Construction Project", {"project": doc.project}, "name")
        
        if construction_project:
            # Update the Construction Project's actual cost
            update_construction_project_cost(construction_project)
            
            # Log the Purchase Order in the Construction Project's timeline
            frappe.get_doc("Construction Project", construction_project).add_comment(
                "Info", 
                _("Purchase Order {0} for {1} has been submitted").format(
                    "<a href='/app/purchase-order/{0}'>{0}</a>".format(doc.name),
                    frappe.format(doc.grand_total, {"fieldtype": "Currency"})
                )
            )

def on_cancel(doc, method):
    """
    Handler for Purchase Order document on_cancel event
    
    Args:
        doc: The Purchase Order document being cancelled
        method: The method being called
    """
    # Check if this Purchase Order is linked to a Construction Project
    if doc.project:
        # Check if there's a Construction Project linked to this Project
        construction_project = frappe.db.get_value("Construction Project", {"project": doc.project}, "name")
        
        if construction_project:
            # Update the Construction Project's actual cost
            update_construction_project_cost(construction_project)
            
            # Log the Purchase Order cancellation in the Construction Project's timeline
            frappe.get_doc("Construction Project", construction_project).add_comment(
                "Info", 
                _("Purchase Order {0} for {1} has been cancelled").format(
                    "<a href='/app/purchase-order/{0}'>{0}</a>".format(doc.name),
                    frappe.format(doc.grand_total, {"fieldtype": "Currency"})
                )
            )

def update_construction_project_cost(construction_project_name):
    """
    Update the actual cost of a Construction Project based on all linked Purchase Orders
    
    Args:
        construction_project_name: The name of the Construction Project to update
    """
    # Get the Construction Project document
    construction_project = frappe.get_doc("Construction Project", construction_project_name)
    
    # Get the linked ERPNext Project
    if not construction_project.project:
        return
    
    # Calculate the total cost from all submitted Purchase Orders linked to the project
    total_po_cost = frappe.db.sql("""
        SELECT SUM(grand_total)
        FROM `tabPurchase Order`
        WHERE project = %s AND docstatus = 1
    """, construction_project.project)[0][0] or 0
    
    # Update the Construction Project's actual cost
    construction_project.db_set('actual_cost', total_po_cost, update_modified=True)
    
def validate_items_for_project(doc, construction_project):
    """
    Validate that the items in the Purchase Order are allowed for the project
    
    Args:
        doc: The Purchase Order document
        construction_project: The name of the Construction Project
    """
    # Get the Construction Project document
    construction_project_doc = frappe.get_doc("Construction Project", construction_project)
    
    # Check if there's a budget for this project
    if not construction_project_doc.budget_items:
        return
    
    # Create a list of allowed items from the budget
    allowed_items = [item.item_code for item in construction_project_doc.budget_items]
    
    # Check each item in the Purchase Order
    for item in doc.items:
        if item.item_code and item.item_code not in allowed_items:
            frappe.msgprint(
                _("Item {0} is not in the budget for Construction Project {1}").format(
                    item.item_code, construction_project
                ),
                alert=True
            )