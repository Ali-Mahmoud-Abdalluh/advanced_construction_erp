# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, flt, date_diff

class ProjectPhase(Document):
	def validate(self):
		self.validate_dates()
		self.calculate_duration()
	
	def validate_dates(self):
		"""Validate that end date is after start date"""
		if self.start_date and self.end_date:
			if getdate(self.end_date) < getdate(self.start_date):
				frappe.throw(_("End Date cannot be before Start Date"))
	
	def calculate_duration(self):
		"""Calculate duration in days based on start and end dates"""
		if self.start_date and self.end_date:
			self.duration = date_diff(self.end_date, self.start_date) + 1  # inclusive of both start and end dates
	
	def validate_dependencies(self):
		"""Validate that dependent phases exist and have appropriate dates"""
		if self.dependencies:
			dependent_phases = frappe.get_all("Project Phase", 
				filters={"name": self.dependencies},
				fields=["name", "end_date"])
			
			for phase in dependent_phases:
				if phase.end_date and self.start_date:
					if getdate(self.start_date) < getdate(phase.end_date):
						frappe.throw(_("Start Date cannot be before End Date of dependent phase {0}").format(phase.name))
	
	def update_status(self, status=None):
		"""Update phase status"""
		if status:
			self.phase_status = status
			self.save()
			return True
		return False