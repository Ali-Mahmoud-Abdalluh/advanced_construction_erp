# Copyright (c) 2024, Construction Management and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, today

class ComprehensiveRateAnalysis(Document):
	def validate(self):
		self.validate_dates()
		self.calculate_component_totals()
		self.calculate_final_rate()
		self.validate_status()
		self.set_prepared_by()

	def validate_dates(self):
		"""Validate analysis date"""
		if self.analysis_date and self.analysis_date > today():
			frappe.throw("Analysis date cannot be in the future")

	def calculate_component_totals(self):
		"""Calculate totals for material, labor, and equipment components"""
		# Calculate material total
		material_total = 0
		for material in self.material_components:
			material.amount = flt(material.quantity_required) * flt(material.unit_rate)
			material.waste_amount = material.amount * flt(material.waste_percentage) / 100
			material.total_amount = material.amount + material.waste_amount
			material_total += material.total_amount

		# Calculate labor total
		labor_total = 0
		for labor in self.labor_components:
			regular_cost = flt(labor.number_of_workers) * flt(labor.hours_per_unit) * flt(labor.hourly_rate)
			overtime_cost = flt(labor.overtime_hours) * flt(labor.overtime_rate)
			labor.amount = regular_cost
			
			# Apply efficiency factor
			efficiency_adjustment = regular_cost * flt(labor.efficiency_factor) / 100
			labor.total_labor_cost = regular_cost + overtime_cost + efficiency_adjustment
			labor_total += labor.total_labor_cost

		# Calculate equipment total
		equipment_total = 0
		for equipment in self.equipment_components:
			base_cost = flt(equipment.hours_per_unit) * flt(equipment.hourly_rate)
			fuel_cost = flt(equipment.hours_per_unit) * flt(equipment.fuel_consumption) * flt(equipment.fuel_rate)
			maintenance_cost = flt(equipment.hours_per_unit) * flt(equipment.maintenance_cost)
			operator_cost = flt(equipment.hours_per_unit) * flt(equipment.operator_cost)
			
			equipment.amount = base_cost
			equipment.total_equipment_cost = base_cost + fuel_cost + maintenance_cost + operator_cost
			
			# Apply utilization factor
			if equipment.utilization_factor:
				equipment.total_equipment_cost = equipment.total_equipment_cost * flt(equipment.utilization_factor) / 100
			
			equipment_total += equipment.total_equipment_cost

		# Set component totals
		self.material_total = material_total
		self.labor_total = labor_total
		self.equipment_total = equipment_total

	def calculate_final_rate(self):
		"""Calculate final rate with waste, overhead, and profit"""
		# Calculate subtotal
		subtotal = flt(self.material_total) + flt(self.labor_total) + flt(self.equipment_total)
		
		# Add waste factor
		self.waste_amount = subtotal * flt(self.waste_factor_percentage) / 100
		self.subtotal = subtotal + self.waste_amount
		
		# Add overhead
		self.overhead_amount = self.subtotal * flt(self.overhead_percentage) / 100
		
		# Add profit
		subtotal_with_overhead = self.subtotal + self.overhead_amount
		self.profit_amount = subtotal_with_overhead * flt(self.profit_percentage) / 100
		
		# Calculate total rate per unit
		self.total_rate_per_unit = subtotal_with_overhead + self.profit_amount
		
		# Apply productivity factor
		if self.productivity_factor:
			self.final_rate = self.total_rate_per_unit * flt(self.productivity_factor)
		else:
			self.final_rate = self.total_rate_per_unit

	def validate_status(self):
		"""Validate status transitions"""
		if self.status == "Approved" and not self.approved_by:
			frappe.throw("Approved By is required when status is Approved")
		
		if self.status == "Approved" and self.approved_by == self.prepared_by:
			frappe.throw("Rate analysis cannot be approved by the same person who prepared it")

	def set_prepared_by(self):
		"""Set prepared by to current user if not set"""
		if not self.prepared_by:
			self.prepared_by = frappe.session.user

	@frappe.whitelist()
	def get_rate_breakdown(self):
		"""Get detailed rate breakdown"""
		return {
			"work_item": self.work_item,
			"unit": self.unit,
			"final_rate": self.final_rate,
			"component_breakdown": {
				"material": self.material_total,
				"labor": self.labor_total,
				"equipment": self.equipment_total
			},
			"cost_factors": {
				"waste_percentage": self.waste_factor_percentage,
				"waste_amount": self.waste_amount,
				"overhead_percentage": self.overhead_percentage,
				"overhead_amount": self.overhead_amount,
				"profit_percentage": self.profit_percentage,
				"profit_amount": self.profit_amount
			},
			"productivity_factor": self.productivity_factor
		}

	@frappe.whitelist()
	def duplicate_analysis(self):
		"""Create a duplicate rate analysis"""
		new_doc = frappe.copy_doc(self)
		new_doc.analysis_title = f"{self.analysis_title} (Copy)"
		new_doc.status = "Draft"
		new_doc.approved_by = None
		new_doc.analysis_date = today()
		new_doc.insert()
		return new_doc.name

	@frappe.whitelist()
	def compare_with_market_rates(self):
		"""Compare with market rates if available"""
		# This would integrate with Market Rate Tracking when implemented
		market_rates = frappe.get_all("Market Rate Tracking", 
			filters={"work_item": self.work_item},
			fields=["average_rate", "min_rate", "max_rate"],
			limit=1
		)
		
		if market_rates:
			market_rate = market_rates[0]
			variance = flt(self.final_rate) - flt(market_rate.average_rate)
			variance_percentage = (variance / flt(market_rate.average_rate)) * 100 if market_rate.average_rate else 0
			
			return {
				"market_average": market_rate.average_rate,
				"market_min": market_rate.min_rate,
				"market_max": market_rate.max_rate,
				"analyzed_rate": self.final_rate,
				"variance": variance,
				"variance_percentage": variance_percentage,
				"competitiveness": "Competitive" if abs(variance_percentage) <= 10 else "Above Market" if variance_percentage > 10 else "Below Market"
			}
		
		return None

	@frappe.whitelist()
	def export_to_estimation(self, estimation_name):
		"""Export this rate analysis to a cost estimation"""
		if not estimation_name:
			return None
		
		estimation = frappe.get_doc("Cost Estimation", estimation_name)
		
		# Add as estimation item
		estimation.append("estimation_items", {
			"item_code": self.work_item,
			"item_description": self.work_description,
			"category": "Labor",  # Default category
			"unit": self.unit,
			"quantity": 1,
			"rate": self.final_rate,
			"amount": self.final_rate,
			"material_cost": self.material_total,
			"labor_cost": self.labor_total,
			"equipment_cost": self.equipment_total,
			"total_cost": self.final_rate,
			"notes": f"Imported from Rate Analysis: {self.name}"
		})
		
		estimation.save()
		return estimation.name