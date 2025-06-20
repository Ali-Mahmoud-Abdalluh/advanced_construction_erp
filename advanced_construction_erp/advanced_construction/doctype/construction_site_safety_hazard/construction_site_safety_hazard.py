# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document

class ConstructionSiteSafetyHazard(Document):
	def validate(self):
		self.validate_risk_level()
		self.validate_hazard_description()
	
	def validate_risk_level(self):
		"""Validate risk level is appropriate"""
		valid_risk_levels = ["Low", "Medium", "High", "Critical"]
		if self.risk_level and self.risk_level not in valid_risk_levels:
			frappe.throw(_("Invalid Risk Level. Must be one of: {0}").format(", ".join(valid_risk_levels)))
	
	def validate_hazard_description(self):
		"""Validate hazard description is provided"""
		if not self.hazard_description or len(self.hazard_description.strip()) < 10:
			frappe.throw(_("Please provide a detailed hazard description (minimum 10 characters)"))
	
	def get_hazard_info(self):
		"""Return formatted hazard information"""
		hazard_info = {
			"type": self.hazard_type,
			"description": self.hazard_description,
			"risk_level": self.risk_level
		}
		
		if self.location:
			hazard_info["location"] = self.location
		
		return hazard_info
	
	def suggest_safety_actions(self):
		"""Suggest safety actions based on hazard type and risk level"""
		suggestions = []
		
		# Basic suggestions based on risk level
		if self.risk_level == "Critical":
			suggestions.append({
				"action": "Immediate work stoppage in affected area",
				"priority": "High",
				"target_days": 1
			})
			suggestions.append({
				"action": "Emergency safety meeting with all site personnel",
				"priority": "High",
				"target_days": 1
			})
		elif self.risk_level == "High":
			suggestions.append({
				"action": "Implement temporary control measures",
				"priority": "High",
				"target_days": 2
			})
			suggestions.append({
				"action": "Safety briefing for workers in affected area",
				"priority": "Medium",
				"target_days": 3
			})
		elif self.risk_level == "Medium":
			suggestions.append({
				"action": "Review and update safety procedures",
				"priority": "Medium",
				"target_days": 5
			})
		elif self.risk_level == "Low":
			suggestions.append({
				"action": "Monitor situation and document in safety log",
				"priority": "Low",
				"target_days": 7
			})
		
		# Additional suggestions based on hazard type
		if self.hazard_type == "Fall Hazard":
			suggestions.append({
				"action": "Inspect and reinforce guardrails and fall protection",
				"priority": "High" if self.risk_level in ["Critical", "High"] else "Medium",
				"target_days": 2 if self.risk_level in ["Critical", "High"] else 5
			})
		elif self.hazard_type == "Electrical Hazard":
			suggestions.append({
				"action": "Electrical safety inspection by qualified electrician",
				"priority": "High" if self.risk_level in ["Critical", "High"] else "Medium",
				"target_days": 2 if self.risk_level in ["Critical", "High"] else 5
			})
		elif self.hazard_type == "Chemical Hazard":
			suggestions.append({
				"action": "Review chemical storage and handling procedures",
				"priority": "High" if self.risk_level in ["Critical", "High"] else "Medium",
				"target_days": 2 if self.risk_level in ["Critical", "High"] else 5
			})
		elif self.hazard_type == "Fire Hazard":
			suggestions.append({
				"action": "Inspect fire extinguishers and emergency exits",
				"priority": "High" if self.risk_level in ["Critical", "High"] else "Medium",
				"target_days": 2 if self.risk_level in ["Critical", "High"] else 5
			})
		
		return suggestions