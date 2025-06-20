# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today, add_days, cint

class ConstructionSiteFacility(Document):
	def validate(self):
		self.validate_dates()
		self.check_maintenance_due()
	
	def validate_dates(self):
		"""Validate that installation date is not in the future and maintenance due date is after installation date"""
		if self.installation_date and getdate(self.installation_date) > getdate(today()):
			frappe.throw(_("Installation Date cannot be in the future"))
		
		if self.installation_date and self.maintenance_due_date and getdate(self.maintenance_due_date) < getdate(self.installation_date):
			frappe.throw(_("Maintenance Due Date cannot be before Installation Date"))
	
	def check_maintenance_due(self):
		"""Check if maintenance is due or overdue"""
		if self.maintenance_due_date:
			days_to_maintenance = (getdate(self.maintenance_due_date) - getdate(today())).days
			
			if days_to_maintenance < 0:
				return "overdue"
			elif days_to_maintenance <= 7:
				return "due_soon"
		
		return "not_due"
	
	def get_facility_status(self):
		"""Return facility status with maintenance information"""
		status_info = {
			"status": self.status,
			"facility_type": self.facility_type,
			"facility_name": self.facility_name
		}
		
		if self.maintenance_due_date:
			status_info["maintenance_status"] = self.check_maintenance_due()
			status_info["maintenance_due_date"] = self.maintenance_due_date
		
		if self.responsible_person:
			status_info["responsible_person"] = self.responsible_person
		
		return status_info