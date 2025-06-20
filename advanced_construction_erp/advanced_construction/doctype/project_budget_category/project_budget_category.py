# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

class ProjectBudgetCategory(Document):
	def validate(self):
		self.calculate_variance()
	
	def calculate_variance(self):
		"""Calculate variance between budgeted and actual amounts"""
		if self.budgeted_amount is not None and self.actual_spent is not None:
			self.variance = flt(self.budgeted_amount) - flt(self.actual_spent)
		else:
			self.variance = 0
	
	def calculate_percentage(self, total_budget):
		"""Calculate percentage of total budget"""
		if total_budget and flt(total_budget) > 0 and self.budgeted_amount:
			self.percentage_of_total = (flt(self.budgeted_amount) / flt(total_budget)) * 100
		else:
			self.percentage_of_total = 0