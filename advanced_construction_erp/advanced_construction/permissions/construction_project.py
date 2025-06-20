# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def has_permission(doc, ptype, user):
    """
    Custom permission check for Construction Project
    
    Args:
        doc: The document to check permissions on
        ptype: The permission type (read, write, create, delete, etc.)
        user: The user to check permissions for
        
    Returns:
        bool: True if the user has permission, False otherwise
    """
    # System Manager can do anything
    if "System Manager" in frappe.get_roles(user):
        return True
        
    # Construction Manager can do anything
    if "Construction Manager" in frappe.get_roles(user):
        return True
        
    # Construction User can only read
    if "Construction User" in frappe.get_roles(user):
        if ptype == "read":
            return True
        else:
            return False
            
    # Project Manager can read and write projects they are assigned to
    if "Project Manager" in frappe.get_roles(user):
        # Get the employee linked to the user
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        
        if not employee:
            return False
            
        # Check if the user is the project manager for this project
        if doc.project_manager == employee:
            if ptype in ["read", "write", "report", "email", "print"]:
                return True
                
    # Site Supervisor can read and write projects they are assigned to
    if "Site Supervisor" in frappe.get_roles(user):
        # Get the employee linked to the user
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        
        if not employee:
            return False
            
        # Check if the user is the site supervisor for this project
        if doc.site_supervisor == employee:
            if ptype in ["read", "write", "report", "email", "print"]:
                return True
                
    # Default: no permission
    return False