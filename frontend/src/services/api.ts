import axios from 'axios';
import { demoAnalysis, candidates as defaultCandidates } from '../data';
import type { Analysis, Candidate, ChatMessage, HiringWeights } from '../types';

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getAnalysis(_id: string): Promise<Analysis> {
  await wait();
  return demoAnalysis;
}

export async function getRankings(id: string): Promise<Candidate[]> {
  const analysis = await getAnalysis(id);
  return analysis.candidates;
}

export async function getCandidate(id: string): Promise<Candidate> {
  await wait(180);
  return demoAnalysis.candidates.find((c) => c.id === id) || demoAnalysis.candidates[0];
}

export async function createAnalysis(): Promise<Analysis> {
  await wait();
  return { ...demoAnalysis, id: 'analysis_new', status: 'draft' };
}

export async function uploadJobDescription(file: File) {
  await wait(400);
  return {
    fileName: file.name,
    extractedSkills: demoAnalysis.requiredSkills,
  };
}

export async function uploadResumes(files: File[]) {
  await wait(400);
  return { count: files.length, fileNames: files.map((f) => f.name) };
}

export async function startAnalysis(_id: string) {
  await wait(300);
  return { status: 'processing' as const };
}

export function simulateHiringWeights(
  weights: HiringWeights,
  baseCandidates: Candidate[] = defaultCandidates
): { candidates: (Candidate & { rankDelta: number; originalRank: number })[]; explanation: string } {
  // Normalize weights (default 50)
  const wFrontend = weights.frontend / 50;
  const wBackend = weights.backend / 50;
  const wCloud = weights.cloud / 50;
  const wExp = weights.experience / 50;
  const wProjects = weights.projects / 50;
  const wRequired = weights.requiredSkills / 50;

  const recalculated = baseCandidates.map((c) => {
    let multiplier = 1.0;

    // Frontend weight impact
    const hasAngular = c.matchedSkills.includes('Angular');
    const hasReact = c.matchedSkills.includes('React');
    if (hasAngular || hasReact) {
      multiplier *= 1 + (wFrontend - 1) * 0.15;
    } else {
      multiplier *= 1 - (wFrontend - 1) * 0.1;
    }

    // Backend weight impact
    const hasPython = c.matchedSkills.includes('Python');
    const hasSQL = c.matchedSkills.includes('SQL');
    if (hasPython && hasSQL) {
      multiplier *= 1 + (wBackend - 1) * 0.16;
    } else if (hasPython || hasSQL) {
      multiplier *= 1 + (wBackend - 1) * 0.08;
    } else {
      multiplier *= 1 - (wBackend - 1) * 0.12;
    }

    // Cloud weight impact
    const hasAWS = c.matchedSkills.includes('AWS');
    const hasDocker = c.matchedSkills.includes('Docker');
    if (hasAWS && hasDocker) {
      multiplier *= 1 + (wCloud - 1) * 0.2;
    } else if (hasAWS || hasDocker) {
      multiplier *= 1 + (wCloud - 1) * 0.1;
    } else {
      multiplier *= 1 - (wCloud - 1) * 0.08;
    }

    // Experience weight impact
    if (c.experienceYears >= 3.0) {
      multiplier *= 1 + (wExp - 1) * 0.12;
    } else if (c.experienceYears < 2.0) {
      multiplier *= 1 - (wExp - 1) * 0.1;
    }

    // Projects weight impact
    const strongProjectsCount = c.projects.length;
    if (strongProjectsCount >= 2) {
      multiplier *= 1 + (wProjects - 1) * 0.1;
    }

    // Required skills weight impact
    if (c.requiredSkillsMatched === c.requiredSkillsTotal) {
      multiplier *= 1 + (wRequired - 1) * 0.18;
    } else {
      multiplier *= 1 - (wRequired - 1) * 0.15;
    }

    const calculatedScore = Math.min(99.4, Math.max(25, Number(((c.finalScore ?? 70) * multiplier).toFixed(1))));

    return {
      ...c,
      simulatedScore: calculatedScore,
      originalRank: c.rank,
    };
  });

  // Sort descending
  recalculated.sort((a, b) => b.simulatedScore - a.simulatedScore);

  const rankedWithDelta = recalculated.map((c, index) => {
    const newRank = index + 1;
    const rankDelta = c.originalRank - newRank; // positive means moved up, negative means moved down
    return {
      ...c,
      finalScore: c.simulatedScore,
      rank: newRank,
      rankDelta,
      originalRank: c.originalRank,
    };
  });

  // Generate clear reason explanation
  let explanation = 'Rankings updated based on adjusted hiring parameters. ';
  if (weights.cloud > 65) {
    explanation += 'Increased Cloud/DevOps weighting elevated candidates with verified AWS & Docker experience (e.g. Maya Patel and Leo Martin). ';
  } else if (weights.backend > 65) {
    explanation += 'Elevated Backend weighting prioritized candidates with verified Python and relational SQL pipelines. ';
  } else if (weights.frontend > 65) {
    explanation += 'Heightened Frontend weighting favored candidates with verified Angular and React enterprise experience. ';
  } else if (weights.experience > 65) {
    explanation += 'Experience weighting increased priority for candidates with 3+ years of production engineering experience. ';
  } else {
    explanation += 'Balanced weights evaluate dual semantic match and keyword skill coverage across all requirements.';
  }

  return { candidates: rankedWithDelta, explanation };
}

export async function chatWithRecruiter(
  prompt: string,
  candidates: Candidate[] = defaultCandidates
): Promise<ChatMessage> {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const candidateList = candidates.length > 0 ? candidates : defaultCandidates;

  // Try Python AI Chatbot endpoint first
  try {
    const res = await fetch('http://127.0.0.1:8001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        candidates: candidateList.slice(0, 10),
        job: { title: 'Senior Full Stack Engineer' }
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.response) {
        return {
          id: crypto.randomUUID(),
          role: 'assistant',
          timestamp: time,
          content: data.response
        };
      }
    }
  } catch (e) {
    // Graceful fallback to client engine
  }

  await wait(450);
  const lower = prompt.toLowerCase();

  // 1. Angular matching query
  if (lower.includes('angular')) {
    const angularMatches = candidateList.filter((c) => c.matchedSkills.includes('Angular'));
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `There are ${angularMatches.length} candidates with verified Angular experience in this pool:\n\n` +
        angularMatches.slice(0, 5).map((c) => `• ${c.name} (${c.title}) — Match: ${c.finalScore}% (Semantic: ${c.semanticScore}%, Keywords: ${c.keywordScore}%)`).join('\n') +
        `\n\nRahul Sharma (#1) and Arjun Kumar (#2) present the highest evidence strength with production Angular and TypeScript projects.`,
    };
  }

  // 2. Missing AWS query
  if (lower.includes('missing aws') || lower.includes('lacks aws') || lower.includes('without aws')) {
    const missingAWS = candidateList.filter((c) => !c.matchedSkills.includes('AWS'));
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `${missingAWS.length} out of 18 candidates do not show sufficient evidence of AWS in their resumes. This is the largest skill shortage in this candidate pool.\n\n` +
        `Candidates possessing strong AWS evidence include Maya Patel (#3), Daniel Kim (#6), and Leo Martin (#8). For top candidates like Rahul Sharma and Arjun Kumar, AWS is unverified or limited to resume listings without production project evidence.`,
    };
  }

  // 3. Compare Rahul and Arjun (or general comparison)
  if (lower.includes('compare') || (lower.includes('rahul') && lower.includes('arjun'))) {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `Comparison between Rahul Sharma (Rank #1, 94.0%) and Arjun Kumar (Rank #2, 89.5%):\n\n` +
        `• Match Scores: Rahul leads by +4.5% overall (Semantic: 92% vs 88%, Keyword: 96% vs 91%).\n` +
        `• Skill Breadth: Both possess Angular, React, SQL, and TypeScript. Rahul demonstrates full-stack Python FastAPI microservices at CognitiveScale, whereas Arjun's primary strength is focused in Angular/TypeScript frontend with secondary Python.\n` +
        `• Experience: Rahul has 3.5 years of production experience versus Arjun's 2.5 years.\n` +
        `• Verification: Rahul has a timeline overlap flag between two 2025 internships recommended for verification. Arjun is fully verified with no timeline inconsistencies.`,
    };
  }

  // 4. Why is Rahul ranked #1
  if (lower.includes('why is rahul') || lower.includes('ranked #1') || lower.includes('rank 1')) {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `Rahul Sharma is ranked #1 (94.0% Match Score) because he achieves the highest dual evaluation across this role:\n\n` +
        `1. Semantic Match (92%): His work at CognitiveScale on Angular micro-frontends and Python APIs closely matches the JD architecture.\n` +
        `2. Keyword Match (96%): 5 of 5 required skills (Python, Angular, React, SQL, TypeScript) are confirmed with strong multi-source evidence across work history and projects.\n` +
        `3. Project Depth: Two documented production projects demonstrate real-world scalability (RxJS state management, 4M+ daily SQL event processing).\n\n` +
        `Note: A timeline overlap flag exists on his profile for screening verification, but does not diminish his technical skill match.`,
    };
  }

  // 5. Biggest skill gap
  if (lower.includes('gap') || lower.includes('shortage') || lower.includes('biggest')) {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `The largest candidate gaps in this pool are:\n\n` +
        `1. AWS: 12 candidates missing (only 6 match, 33% coverage)\n` +
        `2. Docker: 10 candidates missing (8 match, 44% coverage)\n` +
        `3. Angular: 10 candidates missing (8 match, 44% coverage)\n\n` +
        `In contrast, SQL (15 matches, 83%) and Python (12 matches, 67%) have the healthiest talent coverage.`,
    };
  }

  // Default helpful response
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    timestamp: time,
    content: `Based on the active analysis of 18 candidates for Senior Full Stack Engineer:\n\n` +
      `The top-tier matches are Rahul Sharma (94.0%), Arjun Kumar (89.5%), and Maya Patel (87.2%). I can compare candidates, detail specific skill coverage (e.g. Angular, AWS, Python), or explain how score weights influence rankings.`,
  };
}
