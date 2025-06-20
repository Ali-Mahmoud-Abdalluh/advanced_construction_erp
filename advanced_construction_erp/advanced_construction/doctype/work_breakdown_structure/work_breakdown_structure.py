# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, flt, cint, nowdate, add_days
from frappe.model.mapper import get_mapped_doc

class WorkBreakdownStructure(Document):
	def validate(self):
		self.validate_dates()
		self.validate_hierarchy()
		self.calculate_duration()
		self.update_progress()
		self.calculate_costs()
		self.validate_project_alignment()
	
	def validate_dates(self):
		"""Validate that end date is after start date"""
		if self.start_date and self.end_date:
			if getdate(self.end_date) < getdate(self.start_date):
				frappe.throw(_("End Date cannot be before Start Date"))
	
	def validate_hierarchy(self):
		"""Validate that parent WBS exists and has appropriate level"""
		if self.parent_wbs:
			parent = frappe.db.get_value("Work Breakdown Structure", self.parent_wbs, "wbs_level")
			if parent:
				if flt(parent) >= flt(self.wbs_level):
					frappe.throw(_("Parent WBS level must be lower than current WBS level"))
				
				# Check for circular references
				self.check_circular_reference()
			else:
				frappe.throw(_("Invalid Parent WBS"))
	
	def check_circular_reference(self):
		"""Check for circular references in WBS hierarchy"""
		if not self.parent_wbs:
			return
			
		parent_list = []
		current_parent = self.parent_wbs
		
		while current_parent:
			if current_parent == self.name:
				frappe.throw(_("Circular Reference detected in WBS hierarchy"))
				
			if current_parent in parent_list:
				frappe.throw(_("Circular Reference detected in WBS hierarchy"))
				
			parent_list.append(current_parent)
			current_parent = frappe.db.get_value("Work Breakdown Structure", current_parent, "parent_wbs")
	
	def calculate_duration(self):
		"""Calculate duration based on start and end dates"""
		if self.start_date and self.end_date:
			delta = getdate(self.end_date) - getdate(self.start_date)
			self.duration_days = delta.days + 1  # inclusive of both start and end dates
	
	def update_progress(self):
		"""Update progress based on child WBS items or tasks"""
		if self.is_group:
			# Calculate progress based on child WBS items
			children = frappe.get_all("Work Breakdown Structure", 
				filters={"parent_wbs": self.name},
				fields=["name", "progress", "weight"])
				
			if children:
				total_weight = sum(flt(child.weight or 1) for child in children)
				weighted_progress = sum(flt(child.progress or 0) * flt(child.weight or 1) for child in children)
				
				if total_weight:
					self.progress = weighted_progress / total_weight
				else:
					self.progress = 0
		else:
			# For leaf WBS items, progress may be updated manually or from tasks
			if not self.progress:
				self.progress = 0
				
			# Update from linked tasks if available
			if self.project:
				tasks = frappe.get_all("Task", 
					filters={"project": self.project, "wbs": self.name},
					fields=["progress"])
					
				if tasks:
					total_progress = sum(flt(task.progress or 0) for task in tasks)
					self.progress = total_progress / len(tasks)
	
	def calculate_costs(self):
		"""Calculate estimated and actual costs"""
		if self.is_group:
			# Sum up costs from children
			children = frappe.get_all("Work Breakdown Structure", 
				filters={"parent_wbs": self.name},
				fields=["estimated_cost", "actual_cost"])
				
			self.estimated_cost = sum(flt(child.estimated_cost or 0) for child in children)
			self.actual_cost = sum(flt(child.actual_cost or 0) for child in children)
		else:
			# For leaf WBS items, costs may be entered directly or calculated from resources
			if not self.estimated_cost:
				self.estimated_cost = 0
				
			if not self.actual_cost:
				self.actual_cost = 0
				
			# Calculate from resources if available
			if hasattr(self, 'resources'):
				self.estimated_cost = sum(flt(resource.estimated_cost or 0) for resource in self.resources)
				self.actual_cost = sum(flt(resource.actual_cost or 0) for resource in self.resources)
		
		# Calculate cost variance
		if self.estimated_cost:
			self.cost_variance = flt(self.actual_cost) - flt(self.estimated_cost)
			self.cost_variance_percentage = (self.cost_variance / self.estimated_cost) * 100 if self.estimated_cost else 0
	
	def validate_project_alignment(self):
		"""Ensure WBS aligns with project timelines"""
		if self.project and self.start_date and self.end_date:
			project_start = frappe.db.get_value("Project", self.project, "expected_start_date")
			project_end = frappe.db.get_value("Project", self.project, "expected_end_date")
			
			if project_start and getdate(self.start_date) < getdate(project_start):
				frappe.msgprint(_("WBS start date is before project start date"), alert=True)
				
			if project_end and getdate(self.end_date) > getdate(project_end):
				frappe.msgprint(_("WBS end date is after project end date"), alert=True)
	
	def on_update(self):
		"""Update parent WBS and create project tasks"""
		self.update_parent()
		self.create_project_tasks()
	
	def update_parent(self):
		"""Update parent WBS with changes from this WBS"""
		if self.parent_wbs:
			parent_doc = frappe.get_doc("Work Breakdown Structure", self.parent_wbs)
			parent_doc.save()
	
	def create_project_tasks(self):
		"""Create project tasks based on this WBS"""
		if self.project and not self.is_group and self.create_tasks:
			# Check if task already exists
			existing_task = frappe.db.exists("Task", {"project": self.project, "wbs": self.name})
			
			if not existing_task:
				task = frappe.new_doc("Task")
				task.subject = self.wbs_name
				task.project = self.project
				task.wbs = self.name
				task.description = self.description
				task.expected_start_date = self.start_date
				task.expected_end_date = self.end_date
				task.status = "Open"
				task.insert()
				
				frappe.msgprint(_("Task {0} created from WBS").format(task.name))
	
	def get_children(self):
		"""Get child WBS items"""
		return frappe.get_all("Work Breakdown Structure", 
			filters={"parent_wbs": self.name},
			fields=["name", "wbs_name", "wbs_code", "wbs_level", "is_group", "progress", 
				"start_date", "end_date", "estimated_cost", "actual_cost"])
	
	def get_tasks(self):
		"""Get tasks linked to this WBS"""
		if not self.project:
			return []
			
		return frappe.get_all("Task", 
			filters={"project": self.project, "wbs": self.name},
			fields=["name", "subject", "status", "progress", "expected_start_date", "expected_end_date"])
	
	def get_gantt_data(self):
		"""Get data for Gantt chart"""
		data = {
			"id": self.name,
			"name": self.wbs_name,
			"start": self.start_date,
			"end": self.end_date,
			"progress": self.progress,
			"dependencies": self.dependencies or ""
		}
		
		if self.is_group:
			children = self.get_children()
			child_data = [frappe.get_doc("Work Breakdown Structure", child.name).get_gantt_data() for child in children]
			data["children"] = child_data
			
		return data

@frappe.whitelist()
def create_child_wbs(source_name, target_doc=None):
	"""Create a child WBS from the current WBS"""
	doc = get_mapped_doc("Work Breakdown Structure", source_name, {
		"Work Breakdown Structure": {
			"doctype": "Work Breakdown Structure",
			"field_map": {
				"project": "project",
				"name": "parent_wbs"
			}
		}
	}, target_doc)
	
	# Set default values for the child
	parent_wbs = frappe.get_doc("Work Breakdown Structure", source_name)
	doc.wbs_level = flt(parent_wbs.wbs_level) + 1
	doc.is_group = 0
	doc.progress = 0
	doc.estimated_cost = 0
	doc.actual_cost = 0
	
	# Generate WBS code based on parent
	if parent_wbs.wbs_code:
		# Get the number of existing children
		existing_children = frappe.get_all("Work Breakdown Structure", 
			filters={"parent_wbs": source_name},
			fields=["count(name) as count"])[0].count
			
		doc.wbs_code = f"{parent_wbs.wbs_code}.{existing_children + 1}"
	
	return doc

@frappe.whitelist()
def create_task(source_name, target_doc=None):
	"""Create a task from WBS"""
	doc = get_mapped_doc("Work Breakdown Structure", source_name, {
		"Work Breakdown Structure": {
			"doctype": "Task",
			"field_map": {
				"project": "project",
				"wbs_name": "subject",
				"description": "description",
				"start_date": "expected_start_date",
				"end_date": "expected_end_date",
				"name": "wbs"
			}
		}
	}, target_doc)
	
	doc.status = "Open"
	
	return doc