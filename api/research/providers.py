"""
AI Provider Integration for Deep Research

This module handles AI model calls for generating queries, processing research results,
and writing final reports using the existing DeepWiki model clients.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from api.config import get_model_config, GOOGLE_API_KEY, OPENAI_API_KEY
from api.openai_client import OpenAIClient
from adalflow.core.types import ModelType

logger = logging.getLogger(__name__)


def system_prompt() -> str:
    """Generate system prompt for research operations"""
    now = datetime.now().isoformat()
    return f"""You are an expert code researcher and analyst. Today is {now}. Follow these instructions when responding:
  - You are analyzing code repositories to answer specific technical questions.
  - The user is a highly experienced developer, no need to simplify, be as detailed as possible.
  - Be highly organized and systematic in your research approach.
  - Be proactive and anticipate information needs.
  - Treat the user as an expert in software development.
  - Mistakes erode trust, so be accurate and thorough in code analysis.
  - Provide detailed explanations with code references.
  - Value good architectural patterns and best practices.
  - Consider edge cases and potential issues in the code.
  - You may use speculation when code is unclear, but flag it clearly."""


async def generate_research_queries(
    original_query: str,
    num_queries: int = 3,
    learnings: Optional[List[str]] = None,
    provider: str = "google",
    model: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Generate research queries based on the original question and previous learnings.
    
    Args:
        original_query: The original research question
        num_queries: Number of queries to generate
        learnings: Previous learnings from research iterations
        provider: Model provider to use
        model: Specific model name
    
    Returns:
        List of query dictionaries with 'query' and 'research_goal' keys
    """
    learnings_text = ""
    if learnings:
        learnings_text = f"\n\nHere are some learnings from previous research iterations, use them to generate more specific queries:\n" + "\n".join([f"- {l}" for l in learnings])
    
    prompt = f"""Given the following question about a code repository, generate a list of specific search queries to investigate the codebase. 
Return a maximum of {num_queries} queries, but feel free to return fewer if the original question is straightforward.
Make sure each query is unique and targets different aspects of the codebase.

<question>{original_query}</question>{learnings_text}

For each query, provide:
1. The search query string (keywords or phrases to search in the code)
2. A research goal explaining what we're trying to learn and how to advance the investigation

Respond in JSON format with the following structure:
{{
    "queries": [
        {{
            "query": "search terms for the codebase",
            "research_goal": "Explain what we're investigating and why, and suggest follow-up directions"
        }}
    ]
}}"""
    
    try:
        model_config = get_model_config(provider, model)
        
        if provider == "openai":
            client = OpenAIClient()
            model_kwargs = {
                "model": model or model_config["model"],
                "temperature": 0.7,
                "response_format": {"type": "json_object"}
            }
            
            api_kwargs = client.convert_inputs_to_api_kwargs(
                input=f"{system_prompt()}\n\n{prompt}",
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM
            )
            
            response = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            
            # Extract JSON from OpenAI response
            import json
            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
                result = json.loads(content)
                return result.get("queries", [])[:num_queries]
        
        elif provider == "google":
            import google.generativeai as genai
            import json
            
            # Configure API key
            if GOOGLE_API_KEY:
                genai.configure(api_key=GOOGLE_API_KEY)
            
            model_name = model or model_config["model"]
            gen_model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={
                    "temperature": 0.7,
                    "response_mime_type": "application/json"
                }
            )
            
            full_prompt = f"{system_prompt()}\n\n{prompt}"
            response = gen_model.generate_content(full_prompt)
            
            if hasattr(response, 'text'):
                result = json.loads(response.text)
                return result.get("queries", [])[:num_queries]
        
        logger.warning(f"Unsupported provider {provider}, returning empty queries")
        return []
        
    except Exception as e:
        logger.error(f"Error generating research queries: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return []


async def process_research_results(
    query: str,
    retrieved_docs: List[Any],
    num_learnings: int = 3,
    num_follow_ups: int = 3,
    provider: str = "google",
    model: Optional[str] = None
) -> Dict[str, List[str]]:
    """
    Process retrieved code documents and extract learnings and follow-up questions.
    
    Args:
        query: The search query that was used
        retrieved_docs: List of retrieved document objects from RAG
        num_learnings: Number of learnings to extract
        num_follow_ups: Number of follow-up questions to generate
        provider: Model provider to use
        model: Specific model name
    
    Returns:
        Dictionary with 'learnings' and 'follow_up_questions' keys
    """
    if not retrieved_docs:
        return {"learnings": [], "follow_up_questions": []}
    
    # Format documents for the prompt
    contents = []
    for doc in retrieved_docs[:10]:  # Limit to top 10 documents
        if hasattr(doc, 'text') and doc.text:
            file_path = doc.meta_data.get('file_path', 'unknown') if hasattr(doc, 'meta_data') else 'unknown'
            contents.append(f"File: {file_path}\n\n{doc.text}")
    
    if not contents:
        return {"learnings": [], "follow_up_questions": []}
    
    contents_text = "\n\n---\n\n".join(contents)
    
    prompt = f"""Given the following code snippets retrieved for the query "{query}", analyze the code and extract key learnings.

Return a maximum of {num_learnings} learnings and {num_follow_ups} follow-up questions.

Make sure each learning is:
- Concise but information-dense
- Specific to the code shown (include file paths, function names, class names, etc.)
- Includes important technical details, patterns, or architectural decisions

<code_snippets>
{contents_text}
</code_snippets>

Respond in JSON format:
{{
    "learnings": [
        "Specific learning with technical details from the code"
    ],
    "follow_up_questions": [
        "Follow-up question to investigate further"
    ]
}}"""
    
    try:
        model_config = get_model_config(provider, model)
        
        if provider == "openai":
            client = OpenAIClient()
            model_kwargs = {
                "model": model or model_config["model"],
                "temperature": 0.7,
                "response_format": {"type": "json_object"}
            }
            
            api_kwargs = client.convert_inputs_to_api_kwargs(
                input=f"{system_prompt()}\n\n{prompt}",
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM
            )
            
            response = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            
            # Extract JSON from OpenAI response
            import json
            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
                result = json.loads(content)
                return {
                    "learnings": result.get("learnings", [])[:num_learnings],
                    "follow_up_questions": result.get("follow_up_questions", [])[:num_follow_ups]
                }
        
        elif provider == "google":
            import google.generativeai as genai
            import json
            
            # Configure API key
            if GOOGLE_API_KEY:
                genai.configure(api_key=GOOGLE_API_KEY)
            
            model_name = model or model_config["model"]
            gen_model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={
                    "temperature": 0.7,
                    "response_mime_type": "application/json"
                }
            )
            
            full_prompt = f"{system_prompt()}\n\n{prompt}"
            response = gen_model.generate_content(full_prompt)
            
            if hasattr(response, 'text'):
                result = json.loads(response.text)
                return {
                    "learnings": result.get("learnings", [])[:num_learnings],
                    "follow_up_questions": result.get("follow_up_questions", [])[:num_follow_ups]
                }
        
        logger.warning(f"Unsupported provider {provider}, returning empty results")
        return {"learnings": [], "follow_up_questions": []}
        
    except Exception as e:
        logger.error(f"Error processing research results: {e}")
        return {"learnings": [], "follow_up_questions": []}


async def write_final_report_streaming(
    original_query: str,
    learnings: List[str],
    provider: str = "google",
    model: Optional[str] = None,
    on_chunk: Optional[Any] = None
):
    """
    Write a comprehensive final report based on all research learnings.
    
    Args:
        original_query: The original research question
        learnings: All learnings collected during research
        provider: Model provider to use
        model: Specific model name
    
    Returns:
        Final report in markdown format
    """
    learnings_text = "\n".join([f"{i+1}. {learning}" for i, learning in enumerate(learnings)])
    
    prompt = f"""Based on the following research question and all the learnings gathered from analyzing the codebase, 
write a comprehensive final report.

<question>
{original_query}
</question>

<learnings>
{learnings_text}
</learnings>

Write a detailed technical report that:
1. Directly answers the original question
2. Incorporates ALL the learnings from the research
3. Includes specific code references (file paths, function names, classes, etc.)
4. Explains architectural patterns and design decisions
5. Provides code examples where relevant
6. Is formatted in clean Markdown

The report should be comprehensive (aim for detailed coverage) and include all relevant technical details discovered during research.

Write the report in Markdown format."""
    
    try:
        model_config = get_model_config(provider, model)
        
        if provider == "openai":
            client = OpenAIClient()
            model_kwargs = {
                "model": model or model_config["model"],
                "temperature": 0.7,
                "stream": True
            }
            
            api_kwargs = client.convert_inputs_to_api_kwargs(
                input=f"{system_prompt()}\n\n{prompt}",
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM
            )
            
            response = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            
            # Stream chunks
            async for chunk in response:
                if hasattr(chunk, 'choices') and chunk.choices:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        if on_chunk:
                            await on_chunk(delta.content)
                        yield delta.content
        
        elif provider == "google":
            import google.generativeai as genai
            
            # Configure API key
            if GOOGLE_API_KEY:
                genai.configure(api_key=GOOGLE_API_KEY)
            
            model_name = model or model_config["model"]
            gen_model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"temperature": 0.7}
            )
            
            full_prompt = f"{system_prompt()}\n\n{prompt}"
            response = gen_model.generate_content(full_prompt, stream=True)
            
            # Stream chunks
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    if on_chunk:
                        await on_chunk(chunk.text)
                    yield chunk.text
        
        else:
            logger.warning(f"Unsupported provider {provider}, returning error message")
            error_msg = "Error: Unable to generate report with the specified provider."
            if on_chunk:
                await on_chunk(error_msg)
            yield error_msg
        
    except Exception as e:
        logger.error(f"Error writing final report: {e}")
        error_msg = f"Error generating final report: {str(e)}"
        if on_chunk:
            await on_chunk(error_msg)
        yield error_msg
