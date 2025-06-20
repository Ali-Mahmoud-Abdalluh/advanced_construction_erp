# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

class ConstructionMaterialRequestItem(Document):
	def validate(self):
		self.validate_quantity()
		self.calculate_amount()
		self.fetch_item_details()
	
	def validate_quantity(self):
		"""Validate that quantity is positive"""
		if flt(self.quantity) <= 0:
			frappe.throw(_("Quantity must be greater than zero"))
	
	def calculate_amount(self):
		"""Calculate amount based on quantity and estimated price"""
		if self.quantity and self.estimated_price:
			self.estimated_amount = flt(self.quantity) * flt(self.estimated_price)
		else:
			self.estimated_amount = 0
	
	def fetch_item_details(self):
		"""Fetch details from linked Construction Material or Item"""
		if self.construction_material and not self.item_code:
			# Fetch details from Construction Material
			material = frappe.get_doc("Construction Material", self.construction_material)
			if not self.description:
				self.description = material.material_name or material.material_description
			if not self.uom:
				self.uom = material.unit_of_measure
			if not self.estimated_price and material.standard_rate:
				self.estimated_price = material.standard_rate
				self.calculate_amount()
		
		elif self.item_code and not self.construction_material:
			# Fetch details from Item
			item = frappe.get_doc("Item", self.item_code)
			if not self.description:
				self.description = item.description or item.item_name
			if not self.uom:
				self.uom = item.stock_uom
			if not self.estimated_price and item.standard_rate:
				self.estimated_price = item.standard_rate
				self.calculate_amount()