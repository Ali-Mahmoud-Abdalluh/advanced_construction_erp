# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

class RiskFactor(Document):
	def validate(self):
		self.calculate_risk_score()
	
	def calculate_risk_score(self):
		"""Calculate risk score based on probability and impact"""
		if self.probability is not None and self.impact is not None:
			# Risk score is typically probability × impact
			self.risk_score = flt(self.probability) * flt(self.impact)
			
			# Update risk level based on score
			self.set_risk_level()
	
	def set_risk_level(self):
		"""Set risk level based on risk score"""
		if self.risk_score is not None:
			score = flt(self.risk_score)
			
			if score < 3:
				self.risk_level = "Low"
			elif score < 6:
				self.risk_level = "Medium"
			elif score < 9:
				self.risk_level = "High"
			else:
				self.risk_level = "Critical"
	
	def suggest_mitigation(self):
		"""Suggest mitigation strategies based on risk category and level"""
		suggestions = {
			"Financial": {
				"High": "Consider insurance, contingency funds, or financial hedging",
				"Critical": "Immediate financial risk assessment and mitigation plan required"
			},
			"Technical": {
				"High": "Conduct technical review, consider alternative approaches",
				"Critical": "Engage technical specialists, develop backup solutions"
			},
			"Schedule": {
				"High": "Adjust timeline, add buffer periods, identify acceleration options",
				"Critical": "Restructure project schedule, consider phased approach"
			},
			"Safety": {
				"High": "Enhanced safety protocols, additional training",
				"Critical": "Stop work assessment, comprehensive safety review"
			}
		}
		
		if self.risk_category in suggestions and self.risk_level in ["High", "Critical"]:
			return suggestions[self.risk_category][self.risk_level]
		
		return "Develop appropriate mitigation strategy based on risk assessment"