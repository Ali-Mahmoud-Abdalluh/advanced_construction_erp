# Copyright (c) 2023, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _

class ProjectBudget(Document):
	def validate(self):
		# Validate dates
		self.validate_dates()
		
		# Calculate budget totals
		self.calculate_budget_totals()
	
	def validate_dates(self):
		"""Validate that expected completion date is after expected start date"""
		if self.expected_start_date and self.expected_completion_date:
			if self.expected_completion_date < self.expected_start_date:
				frappe.throw(_("Expected completion date cannot be before expected start date"))
	
	def calculate_budget_totals(self):
		"""Calculate budget totals from budget categories"""
		total_budgeted = 0
		total_actual = 0
		total_variance = 0
		
		for category in self.budget_categories:
			# Calculate percentage of total
			if category.amount and self.total_budget:
				category.percentage_of_total = (category.amount / self.total_budget) * 100
			
			# Calculate variance
			if category.amount and category.actual_spent:
				category.variance = category.actual_spent - category.amount
			
			# Add to totals
			if category.amount:
				total_budgeted += category.amount
			
			if category.actual_spent:
				total_actual += category.actual_spent
			
			if category.variance:
				total_variance += category.variance
		
		self.total_budgeted_amount = total_budgeted
		self.total_actual_spent = total_actual
		self.total_variance = total_variance
		
		# Calculate variance percentage
		if total_budgeted:
			self.variance_percentage = (total_variance / total_budgeted) * 100
	
	def on_update(self):
		"""Add comments on status and approval changes"""
		if self.has_value_changed('status'):
			self.add_comment('Info', _(f"Status changed to: {self.status}"))
		
		if self.has_value_changed('approval_status'):
			self.add_comment('Info', _(f"Approval status changed to: {self.approval_status}"))
			
			# Update linked Project Estimation status if this budget is approved
			if self.approval_status == "Approved" and self.project_estimation:
				project_estimation = frappe.get_doc("Project Estimation", self.project_estimation)
				project_estimation.budget_status = "Approved"
				project_estimation.save()

@frappe.whitelist()
def make_budget_monitoring(source_name, target_doc=None):
	"""Create Budget Monitoring from Project Budget"""
	def set_missing_values(source, target):
		target.project_budget = source.name
		target.project_name = source.project_name
		target.total_budget = source.total_budget
		target.currency = source.currency
		target.start_date = source.expected_start_date
		target.end_date = source.expected_completion_date
		
		# Add budget categories to monitoring
		for category in source.budget_categories:
			target.append("budget_monitoring_items", {
				"category": category.category,
				"description": category.description,
				"budgeted_amount": category.amount,
				"actual_spent": category.actual_spent or 0,
				"committed_amount": 0,
				"remaining_amount": category.amount - (category.actual_spent or 0),
				"percentage_spent": ((category.actual_spent or 0) / category.amount * 100) if category.amount else 0
			})
	
	doclist = get_mapped_doc("Project Budget", source_name, {
		"Project Budget": {
			"doctype": "Budget Monitoring",
			"field_map": {
				"name": "project_budget",
				"project_name": "project_name",
				"total_budget": "total_budget",
				"currency": "currency",
				"expected_start_date": "start_date",
				"expected_completion_date": "end_date"
			},
			"validation": {
				"status": ["=", "Approved"]
			}
		}
	}, target_doc, set_missing_values)
	
	return doclist