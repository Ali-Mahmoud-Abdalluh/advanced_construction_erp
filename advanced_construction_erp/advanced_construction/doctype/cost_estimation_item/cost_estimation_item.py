# Copyright (c) 2024, Construction Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt

class CostEstimationItem(Document):
	def validate(self):
		self.validate_quantities()
		self.calculate_amounts()

	def validate_quantities(self):
		"""Validate quantity and rate values"""
		if flt(self.quantity) <= 0:
			frappe.throw(f"Quantity must be greater than 0 for item {self.item_code}")
		
		if flt(self.rate) < 0:
			frappe.throw(f"Rate cannot be negative for item {self.item_code}")

	def calculate_amounts(self):
		"""Calculate item amounts"""
		# Calculate basic amount
		self.amount = flt(self.quantity) * flt(self.rate)
		
		# Calculate total cost with waste factor
		base_cost = flt(self.material_cost) + flt(self.labor_cost) + flt(self.equipment_cost) + flt(self.overhead_cost)
		waste_amount = base_cost * flt(self.waste_percentage) / 100
		self.total_cost = base_cost + waste_amount

	@frappe.whitelist()
	def get_item_details(self):
		"""Get detailed breakdown of item costs"""
		return {
			"item_code": self.item_code,
			"description": self.item_description,
			"category": self.category,
			"quantity": self.quantity,
			"unit": self.unit,
			"rate": self.rate,
			"amount": self.amount,
			"cost_breakdown": {
				"material": self.material_cost,
				"labor": self.labor_cost,
				"equipment": self.equipment_cost,
				"overhead": self.overhead_cost,
				"waste_percentage": self.waste_percentage,
				"total_cost": self.total_cost
			}
		}