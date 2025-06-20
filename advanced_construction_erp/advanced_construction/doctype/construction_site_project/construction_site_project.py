# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today, flt

class ConstructionSiteProject(Document):
	def validate(self):
		self.validate_project_link()
		self.update_project_details()
	
	def validate_project_link(self):
		"""Validate that the construction project exists"""
		if self.construction_project:
			project_exists = frappe.db.exists("Construction Project", self.construction_project)
			if not project_exists:
				frappe.throw(_("Construction Project {0} does not exist").format(self.construction_project))
	
	def update_project_details(self):
		"""Update project details from the linked Construction Project"""
		if self.construction_project:
			project = frappe.get_doc("Construction Project", self.construction_project)
			
			# Update fields from the project
			self.project_name = project.project_name
			self.project = project.erpnext_project
			self.status = project.status
			self.start_date = project.expected_start_date
			self.end_date = project.expected_end_date
			self.completion_percentage = project.completion_percentage
	
	def get_project_timeline(self):
		"""Return project timeline information"""
		timeline = {
			"project": self.construction_project,
			"name": self.project_name,
			"status": self.status
		}
		
		if self.start_date:
			timeline["start_date"] = self.start_date
		
		if self.end_date:
			timeline["end_date"] = self.end_date
			
			# Calculate days remaining if project is active
			if self.status in ["Planning", "In Progress"] and getdate(self.end_date) >= getdate(today()):
				timeline["days_remaining"] = (getdate(self.end_date) - getdate(today())).days
		
		if self.completion_percentage is not None:
			timeline["completion"] = flt(self.completion_percentage)
		
		return timeline