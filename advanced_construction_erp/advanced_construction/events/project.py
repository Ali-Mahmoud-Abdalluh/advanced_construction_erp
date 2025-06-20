# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def validate_project(doc, method):
    """
    Handler for Project document validate event
    
    Args:
        doc: The Project document being validated
        method: The method being called
    """
    # Check if this Project is linked to a Construction Project
    if doc.construction_project:
        # Validate that the Project data is consistent with the Construction Project
        validate_project_data(doc, doc.construction_project)

def on_project_submit(doc, method):
    """
    Handler for Project document on_submit event
    
    Args:
        doc: The Project document being submitted
        method: The method being called
    """
    # Check if this Project is linked to a Construction Project
    if doc.construction_project:
        # Update the Construction Project status
        construction_project = frappe.get_doc("Construction Project", doc.construction_project)
        construction_project.status = "In Progress"
        construction_project.save()

def on_project_cancel(doc, method):
    """
    Handler for Project document on_cancel event
    
    Args:
        doc: The Project document being cancelled
        method: The method being called
    """
    # Check if this Project is linked to a Construction Project
    if doc.construction_project:
        # Update the Construction Project status
        construction_project = frappe.get_doc("Construction Project", doc.construction_project)
        construction_project.status = "Cancelled"
        construction_project.save()

def on_update(doc, method):
    """
    Handler for Project document on_update event
    
    Args:
        doc: The Project document being updated
        method: The method being called
    """
    # Check if this Project is linked to a Construction Project
    if doc.construction_project:
        # Update the Construction Project with the latest data from the Project
        construction_project = frappe.get_doc("Construction Project", doc.construction_project)
        
        # Only update if the document exists and is not being updated already
        if construction_project and not construction_project.flags.ignore_on_update:
            # Set a flag to prevent infinite recursion
            construction_project.flags.ignore_on_update = True
            
            # Update fields
            construction_project.status = doc.status
            construction_project.expected_start_date = doc.expected_start_date
            construction_project.expected_end_date = doc.expected_end_date
            construction_project.progress = doc.percent_complete
            
            # Save the document
            construction_project.save(ignore_permissions=True)
            
            # Clear the flag
            construction_project.flags.ignore_on_update = False

def after_insert(doc, method):
    """
    Handler for Project document after_insert event
    
    Args:
        doc: The Project document being inserted
        method: The method being called
    """
    # Check if this Project was created from Quick Entry and needs a Construction Project
    if not doc.construction_project and doc.flags.from_project_quick_entry:
        # Create a new Construction Project
        construction_project = frappe.new_doc("Construction Project")
        construction_project.project = doc.name
        construction_project.project_name = doc.project_name
        construction_project.status = doc.status
        construction_project.expected_start_date = doc.expected_start_date
        construction_project.expected_end_date = doc.expected_end_date
        construction_project.progress = doc.percent_complete
        
        # Set a flag to prevent infinite recursion
        construction_project.flags.ignore_on_update = True
        
        # Save the document
        construction_project.insert(ignore_permissions=True)
        
        # Update the Project with the Construction Project reference
        doc.db_set('construction_project', construction_project.name, update_modified=False)

def validate_project_data(doc, construction_project_name):
    """
    Validate that the Project data is consistent with the Construction Project
    
    Args:
        doc: The Project document
        construction_project_name: The name of the Construction Project
    """
    construction_project = frappe.get_doc("Construction Project", construction_project_name)
    
    # Validate dates
    if doc.expected_start_date and construction_project.expected_start_date and doc.expected_start_date != construction_project.expected_start_date:
        frappe.msgprint(
            _("Expected Start Date in Project {0} does not match with Construction Project {1}").format(
                doc.name, construction_project_name
            ),
            alert=True
        )
    
    if doc.expected_end_date and construction_project.expected_end_date and doc.expected_end_date != construction_project.expected_end_date:
        frappe.msgprint(
            _("Expected End Date in Project {0} does not match with Construction Project {1}").format(
                doc.name, construction_project_name
            ),
            alert=True
        )