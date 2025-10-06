"""
Deep Research Implementation

This module implements iterative deep research on code repositories using RAG-based retrieval.
Instead of web scraping like the demo, it searches the codebase using the RAG system.
"""

import logging
import asyncio
import time
from typing import List, Optional, Callable, Any
from dataclasses import dataclass

from api.rag import RAG
from .providers import (
    generate_research_queries,
    process_research_results,
    write_final_report,
    write_final_report_streaming
)

logger = logging.getLogger(__name__)

# Safety limits
MAX_RESEARCH_TIME = 300  # 5 minutes maximum
MAX_QUERIES_PER_ITERATION = 5
MAX_TOTAL_QUERIES = 20


@dataclass
class ResearchResult:
    """Result of a deep research operation"""
    learnings: List[str]
    final_report: str


async def deep_research(
    query: str,
    rag_instance: RAG,
    breadth: int = 3,
    depth: int = 2,
    provider: str = "openai",
    model: Optional[str] = None,
    language: str = "en",
    on_progress: Optional[Callable[[str], Any]] = None,
    check_cancelled: Optional[Callable[[], bool]] = None
) -> ResearchResult:
    """
    Perform deep research on a code repository using RAG-based retrieval.
    
    This function iteratively generates search queries, retrieves relevant code,
    extracts learnings, and produces a final comprehensive report.
    
    Args:
        query: The original research question
        rag_instance: Initialized RAG instance with loaded repository
        breadth: Number of parallel queries to generate at each iteration
        depth: Number of research iterations to perform
        provider: AI model provider to use
        model: Specific model name
        language: Language for the final report
        on_progress: Optional callback function to report progress (receives status strings)
    
    Returns:
        ResearchResult containing learnings and final report
    """
    logger.info(f"Starting deep research: query='{query}', breadth={breadth}, depth={depth}")
    
    # Safety: limit parameters
    breadth = min(breadth, MAX_QUERIES_PER_ITERATION)
    depth = min(depth, 5)  # Maximum 5 iterations
    
    # Track start time for timeout
    start_time = time.time()
    total_queries = 0
    
    if on_progress:
        await on_progress(f"<think>Starting deep research with depth={depth}, breadth={breadth}</think>")
    
    # Store all learnings across iterations
    all_learnings: List[str] = []
    
    # Perform iterative research
    for iteration in range(depth):
        # Check for cancellation
        if check_cancelled and check_cancelled():
            logger.info("Research cancelled by client")
            if on_progress:
                await on_progress(f"<think>Research cancelled</think>")
            break
        
        # Check timeout
        if time.time() - start_time > MAX_RESEARCH_TIME:
            logger.warning(f"Research timeout after {MAX_RESEARCH_TIME}s")
            if on_progress:
                await on_progress(f"<think>Research timeout - generating report with current findings</think>")
            break
        
        # Check total queries limit
        if total_queries >= MAX_TOTAL_QUERIES:
            logger.warning(f"Reached maximum queries limit ({MAX_TOTAL_QUERIES})")
            if on_progress:
                await on_progress(f"<think>Query limit reached - generating report</think>")
            break
        
        logger.info(f"Research iteration {iteration + 1}/{depth}")
        
        if on_progress:
            await on_progress(f"<think>Research iteration {iteration + 1}/{depth}: Generating search queries...</think>")
        
        # Generate search queries based on the original question and previous learnings
        queries = await generate_research_queries(
            original_query=query,
            num_queries=breadth,
            learnings=all_learnings if all_learnings else None,
            provider=provider,
            model=model
        )
        
        if not queries:
            logger.warning(f"No queries generated for iteration {iteration + 1}")
            if on_progress:
                await on_progress(f"<think>No new queries generated, ending research early</think>")
            break
        
        logger.info(f"Generated {len(queries)} queries for iteration {iteration + 1}")
        
        # Process each query
        iteration_learnings = []
        for i, query_info in enumerate(queries):
            # Check cancellation before each query
            if check_cancelled and check_cancelled():
                break
            
            total_queries += 1
            search_query = query_info.get("query", "")
            research_goal = query_info.get("research_goal", "")
            
            if not search_query:
                continue
            
            logger.info(f"Processing query {i + 1}/{len(queries)}: {search_query}")
            
            if on_progress:
                await on_progress(f"<think>Searching codebase: {search_query}</think>")
            
            # Use RAG to retrieve relevant code documents
            try:
                retrieved_results = rag_instance(search_query, language=language)
                
                if retrieved_results and retrieved_results[0].documents:
                    documents = retrieved_results[0].documents
                    logger.info(f"Retrieved {len(documents)} documents for query: {search_query}")
                    
                    if on_progress:
                        await on_progress(f"<think>Found {len(documents)} relevant code files, analyzing...</think>")
                    
                    # Process the retrieved documents to extract learnings
                    processed = await process_research_results(
                        query=search_query,
                        retrieved_docs=documents,
                        num_learnings=3,
                        num_follow_ups=breadth,
                        provider=provider,
                        model=model
                    )
                    
                    # Collect learnings from this query
                    query_learnings = processed.get("learnings", [])
                    if query_learnings:
                        iteration_learnings.extend(query_learnings)
                        logger.info(f"Extracted {len(query_learnings)} learnings from query: {search_query}")
                        
                        if on_progress:
                            await on_progress(f"<think>Extracted {len(query_learnings)} insights from {search_query}</think>")
                else:
                    logger.warning(f"No documents retrieved for query: {search_query}")
                    if on_progress:
                        await on_progress(f"<think>No relevant code found for: {search_query}</think>")
                        
            except Exception as e:
                logger.error(f"Error retrieving documents for query '{search_query}': {e}")
                if on_progress:
                    await on_progress(f"<think>Error searching for: {search_query}</think>")
                continue
        
        # Add iteration learnings to the total
        if iteration_learnings:
            all_learnings.extend(iteration_learnings)
            logger.info(f"Iteration {iteration + 1} completed: {len(iteration_learnings)} new learnings, {len(all_learnings)} total")
            
            if on_progress:
                await on_progress(f"<think>Iteration {iteration + 1} completed: {len(iteration_learnings)} new insights discovered</think>")
        else:
            logger.warning(f"No learnings extracted in iteration {iteration + 1}")
            if on_progress:
                await on_progress(f"<think>No new insights in iteration {iteration + 1}</think>")
    
    logger.info(f"Research complete: {len(all_learnings)} total learnings collected")
    
    # Generate final report with streaming
    if on_progress:
        await on_progress(f"<think>Generating final comprehensive report...</think>")
    
    if all_learnings:
        # Stream the final report
        final_report_chunks = []
        async for chunk in write_final_report_streaming(
            original_query=query,
            learnings=all_learnings,
            provider=provider,
            model=model,
            on_chunk=on_progress  # Stream report chunks to client
        ):
            final_report_chunks.append(chunk)
        
        final_report = ''.join(final_report_chunks)

        # Non Stream the final report
        # final_report = await write_final_report(
        #     original_query=query,
        #     learnings=all_learnings,
        #     provider=provider,
        #     model=model
        # )
        # if on_progress:
        #     await on_progress(final_report)
        
    else:
        final_report = f"# Research Results\n\nUnable to find sufficient information in the codebase to answer: {query}\n\nPlease try rephrasing your question or ensure the repository has been properly indexed."
        if on_progress:
            await on_progress(final_report)
    
    logger.info("Final report generated")
    
    # if on_progress:
    #     await on_progress(f"<think>Research complete!</think>")
    
    return ResearchResult(
        learnings=all_learnings,
        final_report=final_report
    )
