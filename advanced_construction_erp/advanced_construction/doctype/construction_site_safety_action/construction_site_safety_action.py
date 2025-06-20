# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today, add_days

class ConstructionSiteSafetyAction(Document):
	def validate(self):
		self.validate_dates()
		self.validate_status()
		self.check_overdue()
	
	def validate_dates(self):
		"""Validate target date and completion date"""
		# Target date should not be in the past when creating a new action
		if self.is_new() and self.target_date and getdate(self.target_date) < getdate(today()):
			frappe.throw(_("Target Date cannot be in the past for new safety actions"))
		
		# Completion date should not be before target date
		if self.completion_date and self.target_date and getdate(self.completion_date) < getdate(self.target_date):
			frappe.throw(_("Completion Date cannot be before Target Date"))
		
		# Completion date should not be in the future
		if self.completion_date and getdate(self.completion_date) > getdate(today()):
			frappe.throw(_("Completion Date cannot be in the future"))
	
	def validate_status(self):
		"""Validate status based on dates"""
		# If status is completed, completion date is required
		if self.status == "Completed" and not self.completion_date:
			self.completion_date = today()
		
		# If completion date is set, status should be completed
		if self.completion_date and self.status != "Completed":
			self.status = "Completed"
	
	def check_overdue(self):
		"""Check if action is overdue and update status"""
		if self.target_date and self.status not in ["Completed", "Cancelled"]:
			if getdate(self.target_date) < getdate(today()):
				self.status = "Delayed"
				return True
		return False
	
	def get_action_status(self):
		"""Return formatted action status information"""
		status_info = {
			"description": self.action_description,
			"priority": self.priority,
			"assigned_to": self.assigned_to,
			"target_date": self.target_date,
			"status": self.status
		}
		
		if self.completion_date:
			status_info["completion_date"] = self.completion_date
		
		if self.remarks:
			status_info["remarks"] = self.remarks
		
		# Add overdue flag
		if self.check_overdue():
			status_info["is_overdue"] = True
			status_info["days_overdue"] = (getdate(today()) - getdate(self.target_date)).days
		
		return status_info