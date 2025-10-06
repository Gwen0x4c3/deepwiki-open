"""
Deep Research Module

This module provides deep research capabilities for the DeepWiki system.
It allows iterative investigation of code repositories using RAG-based retrieval.
"""

from .deep_research import deep_research, ResearchResult

__all__ = ["deep_research", "ResearchResult"]
