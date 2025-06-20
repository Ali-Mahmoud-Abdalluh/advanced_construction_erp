# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

class BillofQuantitiesItem(Document):
	def validate(self):
		self.calculate_amount()
	
	def calculate_amount(self):
		"""Calculate amount based on quantity and rate"""
		if self.quantity and self.rate:
			self.amount = flt(self.quantity) * flt(self.rate)
		else:
			self.amount = 0
	
	def get_wbs_details(self):
		"""Fetch details from linked WBS if available"""
		if self.wbs_reference:
			wbs = frappe.get_doc("Work Breakdown Structure", self.wbs_reference)
			return {
				"description": wbs.description,
				"estimated_cost": wbs.estimated_cost
			}
		return None