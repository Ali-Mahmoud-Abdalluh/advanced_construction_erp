# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today

class ConstructionSiteSafety(Document):
	def validate(self):
		self.validate_dates()
		self.set_overall_compliance_status()
	
	def validate_dates(self):
		"""Validate that follow-up date is after inspection date"""
		if self.follow_up_date and getdate(self.follow_up_date) < getdate(self.inspection_date):
			frappe.throw(_("Follow-up Date cannot be before Inspection Date"))
		
		# Validate corrective action target dates
		for action in self.corrective_actions:
			if action.target_date and getdate(action.target_date) < getdate(self.inspection_date):
				frappe.throw(_("Target Date for corrective action cannot be before Inspection Date"))
				
			if action.completion_date and getdate(action.completion_date) < getdate(self.inspection_date):
				frappe.throw(_("Completion Date for corrective action cannot be before Inspection Date"))
	
	def set_overall_compliance_status(self):
		"""Set the overall compliance status based on checklist items"""
		checklist_fields = [
			'ppe_compliance', 'scaffolding_safety', 'electrical_safety', 'fire_safety',
			'equipment_safety', 'hazardous_materials', 'housekeeping', 'first_aid'
		]
		
		# Count the number of non-compliant items
		non_compliant_count = 0
		partially_compliant_count = 0
		compliant_count = 0
		total_applicable = 0
		
		for field in checklist_fields:
			if hasattr(self, field) and getattr(self, field) != 'Not Applicable':
				total_applicable += 1
				if getattr(self, field) == 'Non-Compliant':
					non_compliant_count += 1
				elif getattr(self, field) == 'Partially Compliant':
					partially_compliant_count += 1
				elif getattr(self, field) == 'Compliant':
					compliant_count += 1
		
		# Set overall compliance status based on counts
		if total_applicable == 0:
			# If no applicable items, don't change the status
			return
		
		if non_compliant_count > 0:
			self.compliance_status = 'Non-Compliant'
		elif partially_compliant_count > 0:
			self.compliance_status = 'Partially Compliant'
		else:
			self.compliance_status = 'Compliant'
	
	def on_submit(self):
		"""Create follow-up inspection if needed"""
		if self.compliance_status != 'Compliant' and self.follow_up_date:
			self.create_follow_up_inspection()
	
	def create_follow_up_inspection(self):
		"""Create a follow-up inspection document"""
		follow_up = frappe.new_doc("Construction Site Safety")
		follow_up.construction_site = self.construction_site
		follow_up.inspection_date = self.follow_up_date
		follow_up.inspector_name = self.follow_up_inspector or self.inspector_name
		follow_up.inspector_designation = self.inspector_designation
		follow_up.inspection_type = "Follow-up"
		
		# Copy over non-compliant items
		checklist_fields = [
			'ppe_compliance', 'scaffolding_safety', 'electrical_safety', 'fire_safety',
			'equipment_safety', 'hazardous_materials', 'housekeeping', 'first_aid'
		]
		
		for field in checklist_fields:
			if hasattr(self, field) and getattr(self, field) in ['Non-Compliant', 'Partially Compliant']:
				setattr(follow_up, field, getattr(self, field))
		
		# Copy over hazards that need follow-up
		for hazard in self.hazards_identified:
			follow_up.append("hazards_identified", {
				"hazard_type": hazard.hazard_type,
				"hazard_description": hazard.hazard_description,
				"risk_level": hazard.risk_level,
				"location": hazard.location
			})
		
		# Copy over pending corrective actions
		for action in self.corrective_actions:
			if action.status in ['Pending', 'In Progress', 'Delayed']:
				follow_up.append("corrective_actions", {
					"action_description": action.action_description,
					"priority": action.priority,
					"assigned_to": action.assigned_to,
					"target_date": action.target_date,
					"status": action.status,
					"remarks": action.remarks
				})
		
		follow_up.observations = _('Follow-up inspection for {0} dated {1}').format(
			self.name, self.inspection_date)
		
		return follow_up
	
	@frappe.whitelist()
	def create_and_get_follow_up_inspection(self):
		"""Create a follow-up inspection and return it"""
		follow_up = self.create_follow_up_inspection()
		follow_up.save()
		return follow_up.name