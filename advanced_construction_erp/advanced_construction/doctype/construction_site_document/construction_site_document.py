# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today, add_days, cint

class ConstructionSiteDocument(Document):
	def validate(self):
		self.validate_dates()
		self.check_expiry()
	
	def validate_dates(self):
		"""Validate that issue date is not in the future and expiry date is after issue date"""
		if self.issue_date and getdate(self.issue_date) > getdate(today()):
			frappe.throw(_("Issue Date cannot be in the future"))
		
		if self.issue_date and self.expiry_date and getdate(self.expiry_date) < getdate(self.issue_date):
			frappe.throw(_("Expiry Date cannot be before Issue Date"))
	
	def check_expiry(self):
		"""Check if document is expired or about to expire"""
		if self.expiry_date:
			days_to_expiry = (getdate(self.expiry_date) - getdate(today())).days
			
			if days_to_expiry < 0:
				self.db_set('status', 'Expired', update_modified=False)
				return "expired"
			elif days_to_expiry <= 30:
				return "expiring_soon"
		
		return "valid"
	
	def get_document_info(self):
		"""Return formatted document information"""
		info = {
			"name": self.document_name,
			"type": self.document_type,
			"reference": self.reference_number or "",
			"authority": self.issuing_authority or ""
		}
		
		if self.issue_date:
			info["issued"] = self.issue_date
		
		if self.expiry_date:
			info["expires"] = self.expiry_date
			info["expiry_status"] = self.check_expiry()
		
		return info