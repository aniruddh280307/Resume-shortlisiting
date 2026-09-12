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
  const candidateList = candidates && candidates.length > 0 ? candidates : defaultCandidates;

  // 1. Try Python AI Chatbot endpoint first
  try {
    const res = await fetch('http://127.0.0.1:8001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        candidates: candidateList,
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

  await wait(300);
  const pLower = prompt.toLowerCase();

  // 2. SPECIFIC CANDIDATE INQUIRY
  const matchedCandidate = candidateList.find((c) => {
    const nameLower = c.name.toLowerCase();
    const firstName = nameLower.split(' ')[0];
    return pLower.includes(nameLower) || (firstName.length >= 3 && pLower.includes(firstName));
  });

  if (matchedCandidate) {
    const c = matchedCandidate;
    const isSuspicious = (c.verificationAlerts && c.verificationAlerts.length > 0) || c.verificationStatus === 'review_recommended';
    const alerts = c.verificationAlerts || [];

    // Specific fraud/flags query for this candidate
    if (/fraud|fake|suspicious|flag|alert|anomal|integrity|hidden/i.test(pLower)) {
      if (isSuspicious) {
        const alertList = alerts.map((a: any) => `  • **${a.title || 'Integrity Alert'}** [${(a.severity || 'HIGH').toUpperCase()}]: ${a.message || a.description || 'Detected anomalous layer.'}` + (a.detectedValue || a.detectedText ? `\n    _Detected Snippet_: \`${(a.detectedValue || a.detectedText).slice(0, 80)}\`` : '')).join('\n');
        return {
          id: crypto.randomUUID(),
          role: 'assistant',
          timestamp: time,
          content: `### ⚠️ Integrity Analysis for **${c.name}**\n\n` +
            `**Status**: Review Recommended (${alerts.length} anomalies detected)\n\n` +
            `**Detected Findings**:\n${alertList}\n\n` +
            `💡 **Recruiter Note**: Nexora FraudGuard excluded all hidden keyword injections and fabricated claims from scoring. ${c.name}'s match score (**${c.finalScore}%**) reflects **only verified visible credentials**.`
        };
      } else {
        return {
          id: crypto.randomUUID(),
          role: 'assistant',
          timestamp: time,
          content: `### ✓ Document Integrity for **${c.name}**\n\n` +
            `**Status**: **Verified Clean** · No Anomalies Detected\n\n` +
            `• **Typography**: Passed standard visible font sizes (≥ 8pt)\n` +
            `• **Formatting**: Passed boundary and zero white-font contrast checks\n` +
            `• **Timeline**: Verified chronological employment and degree history.`
        };
      }
    }

    const eduStr = c.education && c.education.length > 0
      ? `${c.education[0].degree} at ${c.education[0].institution} (${c.education[0].year})`
      : 'Education on file';

    const workStr = c.workHistory && c.workHistory.length > 0
      ? `${c.workHistory[0].role} at ${c.workHistory[0].company} (${c.workHistory[0].period})`
      : 'Work history on file';

    const projBullets = c.projects && c.projects.length > 0
      ? c.projects.map((p) => `  • **${p.title}**: ${p.description} (Tech: ${p.technologies.join(', ')})`).join('\n')
      : '  • Projects indexed from resume.';

    const integritySummary = isSuspicious
      ? `⚠️ **Flagged (${alerts.length} anomalies)** — Hidden text/keyword stuffing was caught and purged from score.`
      : `✓ **Verified Document Integrity** — Passed all fraud checks.`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      timestamp: time,
      content: `### Profile Evaluation: **${c.name}** (Rank #${c.rank})\n\n` +
        `• **Target Role Fit**: **${c.finalScore}% Final Match Score** (Semantic: ${c.semanticScore || 0}%, Keywords: ${c.keywordScore || 0}%)\n` +
        `• **Current Role & Experience**: ${c.title} (${c.experienceYears || 0.5} yrs) · ${c.location}\n` +
        `• **Education**: ${eduStr}\n` +
        `• **Recent Experience**: ${workStr}\n` +
        `• **Verified Core Skills**: ${c.matchedSkills.join(', ') || 'Demonstrated skills'}\n` +
        `• **Missing Role Requirements**: ${c.missingSkills.join(', ') || 'None (Full coverage)'}\n\n` +
        `**Demonstrated Projects**:\n${projBullets}\n\n` +
        `**Document Verification**: ${integritySummary}`
    };
  }

  // 3. FRAUD & INTEGRITY QUERIES ACROSS POOL
  if (/fraud|fake|suspicious|flagged|alert|cheat|scam|adversarial/i.test(pLower)) {
    const flagged = candidateList.filter((c) => (c.verificationAlerts && c.verificationAlerts.length > 0) || c.verificationStatus === 'review_recommended');
    if (flagged.length > 0) {
      const bullets = flagged.slice(0, 4).map((fc) => {
        const a = fc.verificationAlerts?.[0] as any;
        const textSnippet = a?.detectedValue || a?.detectedText ? ` (\`${(a.detectedValue || a.detectedText).slice(0, 50)}...\`)` : '';
        return `• **${fc.name}** (Rank #${fc.rank}): **${fc.verificationAlerts?.length || 1} flags** — ${a?.title || 'Formatting anomaly'}${textSnippet}`;
      }).join('\n');

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### 🔍 Nexora FraudGuard Pool Audit\n\n` +
          `Identified **${flagged.length} candidate(s)** with potential document manipulation or hidden adversarial text:\n\n` +
          `${bullets}\n\n` +
          `🛡️ **System Protection**: All concealed text (1.0pt micro-fonts, white-fonts, off-margin ATS stuffing) was stripped out prior to scoring. Match scores accurately reflect genuine qualifications only.`
      };
    } else {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### ✓ Nexora FraudGuard Pool Audit\n\n` +
          `**All ${candidateList.length} candidates in the active pool are verified clean**.\n\n` +
          `Zero hidden text layers, invisible white-fonting (RGB 255), microscopic typography, or timeline overlap conflicts were detected.`
      };
    }
  }

  // 4. CANDIDATE COMPARISONS
  if (/compare|versus| vs /i.test(pLower)) {
    if (candidateList.length >= 2) {
      let c1 = candidateList[0];
      let c2 = candidateList[1];

      const mentioned = candidateList.filter((c) => pLower.includes(c.name.toLowerCase().split(' ')[0]));
      if (mentioned.length >= 2) {
        c1 = mentioned[0];
        c2 = mentioned[1];
      } else if (mentioned.length === 1) {
        c1 = mentioned[0];
        c2 = candidateList.find((c) => c.id !== c1.id) || candidateList[1];
      }

      const score1 = c1.finalScore || 0;
      const score2 = c2.finalScore || 0;
      const ver1 = c1.verificationAlerts && c1.verificationAlerts.length > 0 ? '⚠️ Flagged for review' : '✓ Verified clean';
      const ver2 = c2.verificationAlerts && c2.verificationAlerts.length > 0 ? '⚠️ Flagged for review' : '✓ Verified clean';
      const rec = score1 >= score2 ? `**${c1.name}** holds a +${(score1 - score2).toFixed(1)}% higher match score` : `**${c2.name}** holds a +${(score2 - score1).toFixed(1)}% higher match score`;

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### ⚖️ Side-by-Side Comparison: **${c1.name}** vs **${c2.name}**\n\n` +
          `| Metric | **${c1.name}** (Rank #${c1.rank}) | **${c2.name}** (Rank #${c2.rank}) |\n` +
          `| :--- | :--- | :--- |\n` +
          `| **Overall Match** | **${score1}%** (Sem: ${c1.semanticScore || 0}%, KW: ${c1.keywordScore || 0}%) | **${score2}%** (Sem: ${c2.semanticScore || 0}%, KW: ${c2.keywordScore || 0}%) |\n` +
          `| **Title & Exp** | ${c1.title} (${c1.experienceYears || 0.5} yrs) | ${c2.title} (${c2.experienceYears || 0.5} yrs) |\n` +
          `| **Verified Skills** | ${c1.matchedSkills.join(', ') || 'None'} | ${c2.matchedSkills.join(', ') || 'None'} |\n` +
          `| **Integrity** | ${ver1} | ${ver2} |\n\n` +
          `💡 **Recommendation**: ${rec}. Review evidenced projects and verify any flagged items during technical interview.`
      };
    }
  }

  // 5. SKILL SPECIFIC SEARCH
  const techKeywords = ['python', 'react', 'typescript', 'javascript', 'angular', 'node', 'express', 'sql', 'aws', 'docker', 'kubernetes', 'mongodb', 'figma'];
  const searchedSkill = techKeywords.find((tk) => pLower.includes(tk));

  if (searchedSkill && /who|which|has|knows|experience|candidates|find/i.test(pLower)) {
    const matches = candidateList.filter((c) => c.matchedSkills.some((s) => s.toLowerCase().includes(searchedSkill)) || c.title.toLowerCase().includes(searchedSkill));
    const skillDisplay = searchedSkill.length <= 4 ? searchedSkill.toUpperCase() : searchedSkill.charAt(0).toUpperCase() + searchedSkill.slice(1);

    if (matches.length > 0) {
      const candLines = matches.slice(0, 6).map((c) => `• **${c.name}** (Rank #${c.rank}, **${c.finalScore}% Match**) — ${c.title}, ${c.experienceYears || 0.5} yrs exp.`).join('\n');
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### 🎯 Candidates with Verified **${skillDisplay}** Experience\n\n` +
          `Found **${matches.length} candidate(s)** with demonstrated ${skillDisplay} proficiency:\n\n` +
          `${candLines}\n\n` +
          `Each candidate's profile links to verified code evidence from their work history and projects.`
      };
    } else {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### ⚠️ Skill Coverage: **${skillDisplay}**\n\n` +
          `No candidates in the active pool currently demonstrate verified production experience in **${skillDisplay}**.\n\n` +
          `Consider evaluating candidates with adjacent skillsets or adjusting hiring weights in the dashboard.`
      };
    }
  }

  // 6. TOP CANDIDATE RECOMMENDATION
  if (/best|top|recommend|hire|first|rank 1|rank #1|who should/i.test(pLower)) {
    if (candidateList.length > 0) {
      const topCandidate = [...candidateList].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))[0];
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        timestamp: time,
        content: `### 🏆 Top Candidate Recommendation: **${topCandidate.name}**\n\n` +
          `• **Rank**: #1 with a **${topCandidate.finalScore}% Match Score**\n` +
          `• **Role**: ${topCandidate.title} (${topCandidate.experienceYears || 0.5} years of verified experience)\n` +
          `• **Key Strengths**: Verified skills across **${topCandidate.matchedSkills.join(', ')}**\n` +
          `• **Next Step**: Schedule an initial technical screen to evaluate architectural depth.`
      };
    }
  }

  // 7. DEFAULT CONTEXTUAL INTELLIGENCE
  const topScore = candidateList.length > 0 ? Math.max(...candidateList.map((c) => c.finalScore || 0)) : 0;
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    timestamp: time,
    content: `### Recruiter Assistant Intelligence\n\n` +
      `Active candidate pool: **${candidateList.length} candidates** (Top Match Score: **${topScore}%**).\n\n` +
      `You can ask me to:\n` +
      `• **Evaluate a candidate**: _\"Tell me about Arjun Sharma\"_ or _\"Is Arjun flagged?\"_\n` +
      `• **Compare applicants**: _\"Compare the top 2 candidates\"_\n` +
      `• **Skill lookups**: _\"Who has React experience?\"_ or _\"Which candidates know SQL?\"_\n` +
      `• **Audit integrity**: _\"Show all fraud detection alerts\"_`
  };
}
