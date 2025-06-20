# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document

class ConstructionSite(Document):
	def validate(self):
		self.validate_dates()
		self.set_title()
	
	def validate_dates(self):
		"""Validate that end date is not before start date for projects"""
		for project in self.projects:
			if project.start_date and project.end_date and project.start_date > project.end_date:
				frappe.throw(_("Project '{0}': End date cannot be before start date").format(project.project_name))
	
	def set_title(self):
		"""Set the document title based on site name and location"""
		if self.site_name and self.city:
			self.title = "{0} - {1}".format(self.site_name, self.city)
		elif self.site_name:
			self.title = self.site_name
	
	def get_linked_projects(self):
		"""Return a list of all projects linked to this site"""
		projects = []
		for project in self.projects:
			if project.construction_project:
				projects.append(project.construction_project)
			elif project.project:
				projects.append(project.project)
		return projects
	
	@frappe.whitelist()
	def get_site_overview(self):
		"""Return an overview of the site including projects, facilities, and documents"""
		return {
			"site_name": self.site_name,
			"address": self.address,
			"total_projects": len(self.projects),
			"active_projects": len([p for p in self.projects if p.status == "In Progress"]),
			"total_facilities": len(self.facilities),
			"total_documents": len(self.documents) if hasattr(self, 'documents') else 0,
			"total_images": len(self.images) if hasattr(self, 'images') else 0
		}
	
	@frappe.whitelist()
	def get_project_status_summary(self):
		"""Return a summary of project statuses at this site"""
		status_counts = {
			"Not Started": 0,
			"In Progress": 0,
			"Completed": 0,
			"On Hold": 0,
			"Cancelled": 0
		}
		
		for project in self.projects:
			if project.status in status_counts:
				status_counts[project.status] += 1
			
		return status_counts