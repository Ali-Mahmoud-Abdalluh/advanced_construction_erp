# Copyright (c) 2024, Construction Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, today

class CostEstimation(Document):
	def validate(self):
		self.validate_dates()
		self.calculate_totals()
		self.validate_status()
		self.set_prepared_by()

	def validate_dates(self):
		"""Validate estimation date"""
		if self.estimation_date and self.estimation_date > today():
			frappe.throw("Estimation date cannot be in the future")

	def calculate_totals(self):
		"""Calculate total costs from estimation items"""
		total_material = 0
		total_labor = 0
		total_equipment = 0
		total_overhead = 0
		total_amount = 0

		for item in self.estimation_items:
			# Calculate item amount
			item.amount = flt(item.quantity) * flt(item.rate)
			
			# Calculate total cost including waste
			base_cost = flt(item.material_cost) + flt(item.labor_cost) + flt(item.equipment_cost) + flt(item.overhead_cost)
			waste_amount = base_cost * flt(item.waste_percentage) / 100
			item.total_cost = base_cost + waste_amount
			
			# Add to category totals
			total_material += flt(item.material_cost)
			total_labor += flt(item.labor_cost)
			total_equipment += flt(item.equipment_cost)
			total_overhead += flt(item.overhead_cost)
			total_amount += flt(item.amount)

		# Set totals
		self.total_material_cost = total_material
		self.total_labor_cost = total_labor
		self.total_equipment_cost = total_equipment
		self.total_overhead_cost = total_overhead
		
		# Calculate contingency and profit
		subtotal = total_amount
		self.contingency_amount = subtotal * flt(self.contingency_percentage) / 100
		subtotal_with_contingency = subtotal + self.contingency_amount
		self.profit_margin_amount = subtotal_with_contingency * flt(self.profit_margin_percentage) / 100
		
		# Calculate final total
		self.total_estimated_cost = subtotal_with_contingency + self.profit_margin_amount

	def validate_status(self):
		"""Validate status transitions"""
		if self.status == "Approved" and not self.approved_by:
			frappe.throw("Approved By is required when status is Approved")
		
		if self.status == "Approved" and self.approved_by == self.prepared_by:
			frappe.throw("Estimation cannot be approved by the same person who prepared it")

	def set_prepared_by(self):
		"""Set prepared by to current user if not set"""
		if not self.prepared_by:
			self.prepared_by = frappe.session.user

	@frappe.whitelist()
	def get_estimation_summary(self):
		"""Get formatted estimation summary"""
		return {
			"total_items": len(self.estimation_items),
			"total_cost": self.total_estimated_cost,
			"cost_per_category": {
				"material": self.total_material_cost,
				"labor": self.total_labor_cost,
				"equipment": self.total_equipment_cost,
				"overhead": self.total_overhead_cost
			},
			"margins": {
				"contingency": self.contingency_amount,
				"profit": self.profit_margin_amount
			}
		}

	@frappe.whitelist()
	def duplicate_estimation(self):
		"""Create a duplicate estimation"""
		new_doc = frappe.copy_doc(self)
		new_doc.estimation_title = f"{self.estimation_title} (Copy)"
		new_doc.status = "Draft"
		new_doc.approved_by = None
		new_doc.estimation_date = today()
		new_doc.insert()
		return new_doc.name

	@frappe.whitelist()
	def compare_with_budget(self, budget_name):
		"""Compare estimation with project budget"""
		if not budget_name:
			return None
		
		budget = frappe.get_doc("Project Budget", budget_name)
		variance = flt(self.total_estimated_cost) - flt(budget.total_budget_amount)
		variance_percentage = (variance / flt(budget.total_budget_amount)) * 100 if budget.total_budget_amount else 0
		
		return {
			"budget_amount": budget.total_budget_amount,
			"estimated_amount": self.total_estimated_cost,
			"variance": variance,
			"variance_percentage": variance_percentage,
			"status": "Over Budget" if variance > 0 else "Under Budget" if variance < 0 else "On Budget"
		}