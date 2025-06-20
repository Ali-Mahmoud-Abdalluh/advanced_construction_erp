# Copyright (c) 2023, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _

class BillofQuantities(Document):
	def validate(self):
		# Validate dates
		self.validate_dates()
		
		# Calculate total amount
		self.calculate_total_amount()
	
	def validate_dates(self):
		"""Validate that expected completion date is after expected start date"""
		if self.expected_start_date and self.expected_completion_date:
			if self.expected_completion_date < self.expected_start_date:
				frappe.throw(_("Expected completion date cannot be before expected start date"))
	
	def calculate_total_amount(self):
		"""Calculate total amount from BOQ items"""
		total = 0
		
		for item in self.boq_items:
			# Calculate amount for each item
			if item.quantity and item.rate:
				item.amount = item.quantity * item.rate
			
			# Add to total
			if item.amount:
				total += item.amount
		
		self.total_amount = total
		
		# Calculate variance from estimation
		if self.estimated_cost:
			self.variance_from_estimation = self.total_amount - self.estimated_cost
			if self.estimated_cost:
				self.variance_percentage = (self.variance_from_estimation / self.estimated_cost) * 100
	
	def on_update(self):
		"""Add comments on status changes"""
		if self.has_value_changed('status'):
			self.add_comment('Info', _(f"Status changed to: {self.status}"))
			
			# Update linked Project Estimation status if this BOQ is approved
			if self.status == "Approved" and self.project_estimation:
				project_estimation = frappe.get_doc("Project Estimation", self.project_estimation)
				project_estimation.boq_status = "Approved"
				project_estimation.save()

@frappe.whitelist()
def make_purchase_order(source_name, target_doc=None):
	"""Create Purchase Order from Bill of Quantities"""
	def set_missing_values(source, target):
		target.bill_of_quantities = source.name
		target.project_name = source.project_name
		target.schedule_date = source.expected_start_date
		target.currency = source.currency
	
	def update_item(source, target, source_parent):
		target.item_code = source.item_code
		target.item_name = source.description
		target.description = source.description
		target.qty = source.quantity
		target.rate = source.rate
		target.amount = source.amount
		target.uom = source.uom
		target.conversion_factor = 1.0
	
	doclist = get_mapped_doc("Bill of Quantities", source_name, {
		"Bill of Quantities": {
			"doctype": "Purchase Order",
			"field_map": {
				"name": "bill_of_quantities",
				"project_name": "project",
				"expected_start_date": "schedule_date",
				"currency": "currency"
			},
			"validation": {
				"status": ["=", "Approved"]
			}
		},
		"Bill of Quantities Item": {
			"doctype": "Purchase Order Item",
			"field_map": {
				"item_code": "item_code",
				"description": "description",
				"quantity": "qty",
				"rate": "rate",
				"amount": "amount",
				"uom": "uom"
			},
			"postprocess": update_item
		}
	}, target_doc, set_missing_values)
	
	return doclist