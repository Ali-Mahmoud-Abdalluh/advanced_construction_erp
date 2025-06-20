# Copyright (c) 2023, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _

class ProjectEstimation(Document):
	def validate(self):
		# Validate dates
		self.validate_dates()
		
		# Calculate total project cost
		self.calculate_total_project_cost()
		
		# Validate percentages
		self.validate_percentages()
	
	def validate_dates(self):
		"""Validate that expected completion date is after expected start date"""
		if self.expected_start_date and self.expected_completion_date:
			if self.expected_completion_date < self.expected_start_date:
				frappe.throw(_("Expected completion date cannot be before expected start date"))
	
	def validate_percentages(self):
		"""Validate that percentage fields are between 0 and 100"""
		percentage_fields = [
			'contingency_percentage', 'escalation_percentage', 
			'overhead_percentage', 'profit_percentage',
			'risk_contingency_percentage'
		]
		
		for field in percentage_fields:
			if hasattr(self, field) and getattr(self, field) is not None:
				if getattr(self, field) < 0 or getattr(self, field) > 100:
					frappe.throw(_(f"{field.replace('_', ' ').title()} should be between 0 and 100%"))
	
	def calculate_total_project_cost(self):
		"""Calculate total project cost based on all cost components"""
		# Calculate direct costs
		direct_cost_fields = ['material_costs', 'labor_costs', 'equipment_costs', 'subcontractor_costs']
		total_direct_costs = sum(getattr(self, field) or 0 for field in direct_cost_fields)
		self.total_direct_costs = total_direct_costs
		
		# Calculate indirect costs
		indirect_cost_fields = [
			'project_management_costs', 'engineering_design_costs', 'permit_fees',
			'insurance_costs', 'temporary_facilities_costs', 'general_conditions'
		]
		total_indirect_costs = sum(getattr(self, field) or 0 for field in indirect_cost_fields)
		self.total_indirect_costs = total_indirect_costs
		
		# Calculate base cost
		self.total_base_cost = total_direct_costs + total_indirect_costs
		
		# Calculate percentage-based amounts
		if self.total_base_cost:
			if self.contingency_percentage:
				self.contingency_amount = self.total_base_cost * (self.contingency_percentage / 100)
			
			if self.escalation_percentage:
				self.escalation_amount = self.total_base_cost * (self.escalation_percentage / 100)
			
			if self.overhead_percentage:
				self.overhead_amount = self.total_base_cost * (self.overhead_percentage / 100)
			
			if self.profit_percentage:
				self.profit_amount = self.total_base_cost * (self.profit_percentage / 100)
			
			if self.risk_contingency_percentage:
				self.risk_contingency_amount = self.total_base_cost * (self.risk_contingency_percentage / 100)
		
		# Calculate other costs
		other_cost_fields = [
			'contingency_amount', 'escalation_amount', 'overhead_amount',
			'profit_amount', 'risk_contingency_amount'
		]
		total_other_costs = sum(getattr(self, field) or 0 for field in other_cost_fields)
		self.total_other_costs = total_other_costs
		
		# Calculate total project cost
		self.total_project_cost = self.total_base_cost + self.total_other_costs
		
		# Calculate variance from budget
		if self.estimated_budget and self.total_project_cost:
			self.cost_variance_from_budget = self.total_project_cost - self.estimated_budget
			if self.estimated_budget:
				self.cost_variance_percentage = (self.cost_variance_from_budget / self.estimated_budget) * 100
	
	def on_update(self):
		"""Add comments on status and approval changes"""
		if self.has_value_changed('status'):
			self.add_comment('Info', _(f"Status changed to: {self.status}"))
		
		if self.has_value_changed('approval_status'):
			self.add_comment('Info', _(f"Approval status changed to: {self.approval_status}"))
			
			# Update linked Feasibility Study status if this estimation is approved
			if self.approval_status == "Approved" and self.feasibility_study:
				feasibility_study = frappe.get_doc("Feasibility Study", self.feasibility_study)
				feasibility_study.estimation_status = "Approved"
				feasibility_study.save()
				
				# Update linked Construction Lead status
				if feasibility_study.construction_lead:
					lead = frappe.get_doc("Construction Lead", feasibility_study.construction_lead)
					lead.status = "Estimation Approved"
					lead.save()

@frappe.whitelist()
def make_bill_of_quantities(source_name, target_doc=None):
	"""Create Bill of Quantities from Project Estimation"""
	def set_missing_values(source, target):
		target.project_estimation = source.name
		target.project_name = source.project_name
		target.estimated_cost = source.total_project_cost
		target.currency = source.currency
		target.expected_start_date = source.expected_start_date
		target.expected_completion_date = source.expected_completion_date
	
	doclist = get_mapped_doc("Project Estimation", source_name, {
		"Project Estimation": {
			"doctype": "Bill of Quantities",
			"field_map": {
				"name": "project_estimation",
				"project_name": "project_name",
				"total_project_cost": "estimated_cost",
				"currency": "currency",
				"expected_start_date": "expected_start_date",
				"expected_completion_date": "expected_completion_date"
			}
		}
	}, target_doc, set_missing_values)
	
	return doclist

@frappe.whitelist()
def make_project_budget(source_name, target_doc=None):
	"""Create Project Budget from Project Estimation"""
	def set_missing_values(source, target):
		target.project_estimation = source.name
		target.project_name = source.project_name
		target.total_budget = source.total_project_cost
		target.currency = source.currency
		target.expected_start_date = source.expected_start_date
		target.expected_completion_date = source.expected_completion_date
		
		# Map cost categories
		target.append("budget_categories", {
			"category": "Materials",
			"amount": source.material_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Labor",
			"amount": source.labor_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Equipment",
			"amount": source.equipment_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Subcontractors",
			"amount": source.subcontractor_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Project Management",
			"amount": source.project_management_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Engineering & Design",
			"amount": source.engineering_design_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Permits & Fees",
			"amount": source.permit_fees or 0
		})
		
		target.append("budget_categories", {
			"category": "Insurance",
			"amount": source.insurance_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "Temporary Facilities",
			"amount": source.temporary_facilities_costs or 0
		})
		
		target.append("budget_categories", {
			"category": "General Conditions",
			"amount": source.general_conditions or 0
		})
		
		target.append("budget_categories", {
			"category": "Contingency",
			"amount": source.contingency_amount or 0
		})
		
		target.append("budget_categories", {
			"category": "Escalation",
			"amount": source.escalation_amount or 0
		})
		
		target.append("budget_categories", {
			"category": "Overhead",
			"amount": source.overhead_amount or 0
		})
		
		target.append("budget_categories", {
			"category": "Profit",
			"amount": source.profit_amount or 0
		})
		
		target.append("budget_categories", {
			"category": "Risk Contingency",
			"amount": source.risk_contingency_amount or 0
		})
	
	doclist = get_mapped_doc("Project Estimation", source_name, {
		"Project Estimation": {
			"doctype": "Project Budget",
			"field_map": {
				"name": "project_estimation",
				"project_name": "project_name",
				"total_project_cost": "total_budget",
				"currency": "currency",
				"expected_start_date": "expected_start_date",
				"expected_completion_date": "expected_completion_date"
			}
		}
	}, target_doc, set_missing_values)
	
	return doclist