import React, { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  ExternalLink,
  Globe,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Code2,
  Eye,
  Clock,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, SkillEvidence } from '../types';
import { ResumeViewerModal } from './ResumeViewerModal';

interface CandidateDetailViewProps {
  candidate: Candidate;
  onCompareWithAnother?: (candidate: Candidate) => void;
  onBack?: () => void;
}

export function CandidateDetailView({ candidate: c, onCompareWithAnother, onBack }: CandidateDetailViewProps) {
  const navigate = useNavigate();
  const [skillFilter, setSkillFilter] = useState<'all' | 'matched' | 'missing'>('all');
  const [showResumeViewer, setShowResumeViewer] = useState(false);

  const isPending = c.analysisPending;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const formatFraudTitle = (type?: string): string => {
    switch (type) {
      case 'white_font': return 'Invisible White-Font Layer (RGB 255)';
      case 'tiny_text': return '1.0pt Micro-Font ATS Keyword Injection';
      case 'off_margin_text': return 'Off-Margin Injected Metadata';
      case 'hidden_behind_image': return 'Text Hidden Behind Image Layer';
      case 'prompt_injection': return 'Adversarial Prompt Injection Attempt';
      case 'timeline_overlap':
      case 'timeline_anomaly': return 'Timeline Chronological Conflict';
      default: return 'Formatting Anomaly Detected';
    }
  };

  const evidenceLevelBadge = (level: SkillEvidence['level']) => {
    switch (level) {
      case 'strong':
        return <span className="evidence-badge strong"><CheckCircle2 size={12} /> Strong Evidence</span>;
      case 'moderate':
        return <span className="evidence-badge moderate"><Sparkles size={12} /> Moderate Evidence</span>;
      case 'limited':
        return <span className="evidence-badge limited"><AlertTriangle size={12} /> Limited Evidence</span>;
      default:
        return <span className="evidence-badge not-found">Skill Not Detected</span>;
    }
  };

  // Build or retrieve skill evidence entries
  const getComputedSkillEvidence = (): Record<string, SkillEvidence> => {
    if (c.skillEvidence && Object.keys(c.skillEvidence).length > 0) {
      return c.skillEvidence;
    }
    const computed: Record<string, SkillEvidence> = {};
    const matched = c.matchedSkills || [];
    const missing = c.missingSkills || [];
    const all = Array.from(new Set([...matched, ...missing]));

    for (const skill of all) {
      const isMatched = matched.includes(skill);
      computed[skill] = {
        skill,
        level: isMatched ? 'strong' : 'not_found',
        priority: 'required',
        details: isMatched
          ? [`Evidenced in candidate profile and projects.`]
          : [`Not detected in verified experience (hidden/fraudulent mentions excluded).`],
        inProjects: isMatched,
        inWorkHistory: isMatched,
        yearsOfExperience: isMatched ? c.experienceYears : undefined
      };
    }
    return computed;
  };

  const skillEvidenceMap = getComputedSkillEvidence();
  const skillEntries = Object.entries(skillEvidenceMap);
  const filteredSkills = skillEntries.filter(([_, ev]) => {
    if (skillFilter === 'matched') return ev.level !== 'not_found';
    if (skillFilter === 'missing') return ev.level === 'not_found';
    return true;
  });

  const alerts = c.verificationAlerts || [];
  const isSuspicious = alerts.length > 0 || c.verificationStatus === 'review_recommended';

  return (
    <div className="candidate-detail-container">
      {/* Top Breadcrumb & Action Bar */}
      <div className="detail-top-bar">
        <button type="button" className="back-link-btn" onClick={handleBack}>
          <ArrowLeft size={16} /> Back to candidates
        </button>
        <div className="detail-actions-right">
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setShowResumeViewer(true)}
          >
            <Eye size={15} /> View Uploaded Resume
          </button>
          {onCompareWithAnother && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onCompareWithAnother(c)}
            >
              Compare Candidate
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            <FileText size={15} /> Export Dossier
          </button>
        </div>
      </div>

      {/* Main Three-Column Layout */}
      <div className="candidate-three-col-layout">
        {/* =========================================================================
            COLUMN 1: CANDIDATE PROFILE & CONTACT
            ========================================================================= */}
        <aside className="col-profile">
          <div className="profile-card">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar-xl">
                {c.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <span className="profile-rank-chip">Rank #{c.rank}</span>
            </div>

            <h1 className="profile-name">{c.name}</h1>
            <p className="profile-role">{c.title}</p>

            <div className="profile-quick-meta">
              <div className="meta-item">
                <MapPin size={14} />
                <span>{c.location}</span>
              </div>
              <div className="meta-item">
                <Briefcase size={14} />
                <span>{c.experienceYears ? `${c.experienceYears} Years Experience` : 'Experience on file'}</span>
              </div>
            </div>

            {/* Resume Attachment Box */}
            <div className="resume-attachment-box">
              <div className="resume-attachment-head">
                <span className="resume-attachment-label">Resume Attachment</span>
                <span className="resume-filetype-badge">
                  {(c.resume?.fileType || 'PDF').toUpperCase()}
                </span>
              </div>
              <p className="resume-filename">
                {c.resume?.fileName || `${c.name}_Resume.pdf`}
              </p>
              <button
                type="button"
                onClick={() => setShowResumeViewer(true)}
                className="resume-doc-btn"
              >
                <Eye size={14} /> Open Document Viewer
              </button>
            </div>

            <hr className="profile-divider" />

            <div className="contact-section">
              <h4>Contact Information</h4>
              <div className="contact-list">
                <a href={`mailto:${c.email}`} className="contact-link">
                  <Mail size={14} />
                  <span>{c.email}</span>
                </a>
                {c.phone && (
                  <div className="contact-link">
                    <Phone size={14} />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="profile-divider" />

            <div className="links-section">
              <h4>Professional Links</h4>
              <div className="social-links-grid">
                {c.links?.linkedin ? (
                  <a
                    href={c.links.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="social-btn"
                  >
                    <ExternalLink size={15} />
                    <span>LinkedIn</span>
                    <ExternalLink size={12} className="ext-icon" />
                  </a>
                ) : (
                  <span className="social-btn disabled">
                    <ExternalLink size={15} />
                    <span>LinkedIn Profile</span>
                  </span>
                )}

                {c.links?.github ? (
                  <a
                    href={c.links.github}
                    target="_blank"
                    rel="noreferrer"
                    className="social-btn"
                  >
                    <Code2 size={15} />
                    <span>GitHub</span>
                    <ExternalLink size={12} className="ext-icon" />
                  </a>
                ) : (
                  <span className="social-btn disabled">
                    <Code2 size={15} />
                    <span>GitHub Profile</span>
                  </span>
                )}

                {c.links?.portfolio && (
                  <a
                    href={c.links.portfolio}
                    target="_blank"
                    rel="noreferrer"
                    className="social-btn full-width"
                  >
                    <Globe size={15} />
                    <span>Portfolio</span>
                    <ExternalLink size={12} className="ext-icon" />
                  </a>
                )}
              </div>
            </div>

            <hr className="profile-divider" />

            <div className="education-section">
              <h4>
                <GraduationCap size={15} /> Education
              </h4>
              {c.education && c.education.length > 0 ? (
                c.education.map((edu, idx) => (
                  <div key={idx} className="edu-entry">
                    <b>{edu.degree}</b>
                    <div className="edu-school">{edu.institution}</div>
                    <div className="edu-year">
                      {edu.year}
                      {edu.details && !edu.year.includes(edu.details) ? ` · ${edu.details}` : ''}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">Education details on file in attached resume.</p>
              )}
            </div>

            {/* External Profile Evidence */}
            {c.externalEvidence && (
              <div className="external-evidence-card">
                <div className="external-head">
                  <Code2 size={14} />
                  <span>External Profile Evidence</span>
                </div>
                {c.externalEvidence.githubRepos && (
                  <div className="ext-repos">
                    <small>Sample Public Repositories:</small>
                    <ul>
                      {c.externalEvidence.githubRepos.map((repo) => (
                        <li key={repo}>
                          <code>{repo}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.externalEvidence.profileHealth && (
                  <div className="ext-health">
                    <Sparkles size={12} />
                    <span>{c.externalEvidence.profileHealth}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* =========================================================================
            COLUMN 2: SKILLS & EXPERIENCE EVIDENCE
            ========================================================================= */}
        <section className="col-skills-experience">
          {/* Section: Technical Skills & Evidence */}
          <div className="content-card">
            <div className="card-heading-bar">
              <div>
                <h2>Technical Skills & Evidence</h2>
                <p>Multi-source evidence extracted from resume text, projects, and work history.</p>
              </div>
              {skillEntries.length > 0 && (
                <div className="filter-pill-group">
                  <button
                    type="button"
                    className={`filter-pill ${skillFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSkillFilter('all')}
                  >
                    All ({skillEntries.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${skillFilter === 'matched' ? 'active' : ''}`}
                    onClick={() => setSkillFilter('matched')}
                  >
                    Evidenced ({c.matchedSkills?.length || skillEntries.filter(([_, e]) => e.level !== 'not_found').length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${skillFilter === 'missing' ? 'active' : ''}`}
                    onClick={() => setSkillFilter('missing')}
                  >
                    Gaps ({c.missingSkills?.length || skillEntries.filter(([_, e]) => e.level === 'not_found').length})
                  </button>
                </div>
              )}
            </div>

            {skillEntries.length > 0 ? (
              <div className="skill-evidence-grid">
                {filteredSkills.map(([skillName, ev]) => (
                  <div key={skillName} className={`skill-evidence-item ${ev.level}`}>
                    <div className="skill-ev-header">
                      <div className="flex items-center gap-2">
                        <b className="skill-title">{skillName}</b>
                        <span className={`priority-tag ${ev.priority}`}>{ev.priority}</span>
                      </div>
                      {evidenceLevelBadge(ev.level)}
                    </div>

                    <ul className="evidence-points">
                      {ev.details.map((detail, dIdx) => (
                        <li key={dIdx}>{detail}</li>
                      ))}
                    </ul>

                    {ev.level !== 'not_found' && (
                      <div className="evidence-tags-row">
                        {ev.inProjects && <span className="evidence-subtag">Used in Projects</span>}
                        {ev.inWorkHistory && <span className="evidence-subtag">Work Experience</span>}
                        {ev.yearsOfExperience ? (
                          <span className="evidence-subtag">{ev.yearsOfExperience} yrs demonstrated</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-950/40 border border-slate-800">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Skills Parsing Pending</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  The applicant's resume is safely uploaded. Trigger the AI intelligence scan when ready to parse comprehensive skill evidence.
                </p>
              </div>
            )}
          </div>

          {/* Section: Project Evidence */}
          <div className="content-card">
            <div className="card-heading-bar">
              <div>
                <h2>
                  <Layers size={18} /> Project Evidence
                </h2>
                <p>Demonstrated hands-on architectural and coding accomplishments.</p>
              </div>
            </div>

            {c.projects && c.projects.length > 0 ? (
              <div className="projects-timeline">
                {c.projects.map((proj, pIdx) => (
                  <div key={pIdx} className="project-card">
                    <div className="project-top">
                      <h4>{proj.title}</h4>
                      {proj.period && <span className="project-period">{proj.period}</span>}
                    </div>
                    <p className="project-desc">{proj.description}</p>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div className="tech-tags">
                        {proj.technologies.map((t) => (
                          <span key={t} className="tech-tag">
                            <Code2 size={11} /> {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">Projects will be indexed once analysis is performed.</p>
            )}
          </div>

          {/* Section: Work Experience */}
          <div className="content-card">
            <div className="card-heading-bar">
              <div>
                <h2>
                  <Briefcase size={18} /> Experience Highlights
                </h2>
                <p>Commercial tenure and verified responsibilities.</p>
              </div>
            </div>

            {c.workHistory && c.workHistory.length > 0 ? (
              <div className="experience-list">
                {c.workHistory.map((job, jIdx) => (
                  <div key={jIdx} className={`experience-card ${job.isOverlap ? 'has-overlap-flag' : ''}`}>
                    <div className="exp-top-row">
                      <div>
                        <b className="exp-role">{job.role}</b>
                        <div className="exp-company">{job.company}</div>
                      </div>
                      <div className="exp-period-wrap">
                        <span className="exp-period">{job.period}</span>
                        {job.isOverlap && (
                          <span className="overlap-indicator-badge">
                            <AlertTriangle size={11} /> Timeline Overlap
                          </span>
                        )}
                      </div>
                    </div>
                    {job.highlights && job.highlights.length > 0 && (
                      <ul className="exp-highlights">
                        {job.highlights.map((h, hIdx) => (
                          <li key={hIdx}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">Detailed work history available in the attached resume document.</p>
            )}
          </div>
        </section>

        {/* =========================================================================
            COLUMN 3: JOB FIT & VERIFICATION ALERTS
            ========================================================================= */}
        <aside className="col-job-fit">
          {/* Main Fit Score Widget */}
          <div className="fit-score-card">
            <span className="fit-eyebrow">OVERALL CANDIDATE FIT</span>
            
            {isPending ? (
              <div className="py-6 text-center">
                <div className="text-3xl font-bold font-mono text-slate-400">—</div>
                <div className="text-xs font-semibold text-blue-400 mt-1 flex items-center justify-center gap-1">
                  <Clock size={13} />
                  Analysis Pending
                </div>
                <p className="text-[11px] text-slate-400 mt-2 max-w-[200px] mx-auto">
                  AI match score will be calculated once the intelligence engine runs.
                </p>
              </div>
            ) : (
              <>
                <div className="big-score-wrap">
                  <div className="big-score-number">{(c.finalScore || 0).toFixed(1)}%</div>
                  <div className="big-score-label">Final Match Score</div>
                </div>

                {/* Semantic vs Keyword Breakdown */}
                <div className="match-breakdown-box">
                  <div className="breakdown-row">
                    <div className="breakdown-label">
                      <span>Semantic Match</span>
                      <b>{c.semanticScore || 0}%</b>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill semantic"
                        style={{ width: `${c.semanticScore || 0}%` }}
                      />
                    </div>
                    <small className="breakdown-desc">Contextual alignment with role architecture</small>
                  </div>

                  <div className="breakdown-row">
                    <div className="breakdown-label">
                      <span>Keyword Match</span>
                      <b>{c.keywordScore || 0}%</b>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill keyword"
                        style={{ width: `${c.keywordScore || 0}%` }}
                      />
                    </div>
                    <small className="breakdown-desc">Direct technical term and skill detection</small>
                  </div>
                </div>

                {/* Required & Preferred Skills Counts */}
                <div className="skill-ratio-grid">
                  <div className="ratio-card">
                    <span>Required Skills</span>
                    <b>
                      {c.requiredSkillsMatched} / {c.requiredSkillsTotal}
                    </b>
                    <div className="ratio-status">
                      {c.requiredSkillsMatched === c.requiredSkillsTotal ? (
                        <span className="text-success">100% Coverage</span>
                      ) : (
                        <span>{Math.round((c.requiredSkillsMatched / (c.requiredSkillsTotal || 1)) * 100)}% Coverage</span>
                      )}
                    </div>
                  </div>

                  <div className="ratio-card">
                    <span>Preferred Skills</span>
                    <b>
                      {c.preferredSkillsMatched} / {c.preferredSkillsTotal}
                    </b>
                    <div className="ratio-status">
                      <span>{Math.round((c.preferredSkillsMatched / (c.preferredSkillsTotal || 1)) * 100)}% Coverage</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Matched Skills List */}
            {c.matchedSkills && c.matchedSkills.length > 0 && (
              <div className="skills-summary-box">
                <span className="summary-title">Matched Skills</span>
                <div className="skills-pill-wrap">
                  {c.matchedSkills.map((s) => (
                    <span key={s} className="matched-pill">
                      <CheckCircle2 size={12} /> {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rationale Explanation */}
            <div className="explanation-box">
              <h4>Candidate Fit Assessment</h4>
              <p>{c.explanation}</p>
            </div>
          </div>

          {/* =========================================================================
              VERIFICATION CARD: FRAUD DETECTION OR VERIFIED INTEGRITY
              ========================================================================= */}
          <div className={`verification-card ${isSuspicious ? 'is-suspicious' : 'is-clean'}`}>
            <div className="verification-head">
              {isSuspicious ? (
                <div className="verif-title-wrap warning">
                  <ShieldAlert size={20} className="text-amber-500" />
                  <div>
                    <h4>Document Integrity Alert</h4>
                    <span className="verif-status-badge review">
                      Review Recommended ({alerts.length} Flagged)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="verif-title-wrap verified">
                  <ShieldCheck size={20} className="text-emerald-500" />
                  <div>
                    <h4>Verified Document Integrity</h4>
                    <span className="verif-status-badge ok">
                      ✓ Verified · No Anomalies Detected
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isSuspicious ? (
              <div className="alert-content-body">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5">
                  <b>Anomaly Warning:</b> Concealed text, typography manipulations, or adversarial prompt injections were identified in this document. These items were purged prior to candidate ranking.
                </p>

                {alerts.map((alert: any, idx: number) => {
                  const fraudType = alert.type || alert.fraudType || 'formatting_anomaly';
                  const title = alert.title || formatFraudTitle(fraudType);
                  const message = alert.message || alert.description || alert.impact || 'Suspicious hidden content or formatting anomaly detected in document layer.';
                  const detected = alert.detectedValue || alert.detectedText || alert.extractedText || '';
                  const severity = alert.severity || 'warning';

                  return (
                    <div key={alert.id || idx} className="alert-item">
                      <div className="flex items-center justify-between mb-1">
                        <b className="alert-title">{title}</b>
                        <span className={`alert-severity-chip ${severity}`}>
                          {String(severity).toUpperCase()}
                        </span>
                      </div>
                      <p className="alert-message">{message}</p>
                      {detected && (
                        <div className="timeline-detail-box">
                          <small>Detected Hidden / Injected Content:</small>
                          <code>{detected}</code>
                        </div>
                      )}
                      {alert.timelineDetails && (
                        <div className="timeline-detail-box">
                          <small>Detected Overlap Range:</small>
                          <code>{alert.timelineDetails}</code>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="score-independence-notice">
                  <div className="notice-icon">i</div>
                  <p>
                    <b>Scoring Policy:</b> The candidate fit score reflects only verified visible skills. Fraudulent keywords and fabricated claims have been excluded from calculations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="verified-body">
                <p className="verified-main-desc">
                  This resume document successfully passed all Nexora automated fraud and formatting integrity checks.
                </p>
                <div className="verified-checklist">
                  <div className="check-item">
                    <Check size={14} className="text-emerald-600" />
                    <span>Standard Visible Typography (&ge; 8pt)</span>
                  </div>
                  <div className="check-item">
                    <Check size={14} className="text-emerald-600" />
                    <span>Document Margins & Printable Area Valid</span>
                  </div>
                  <div className="check-item">
                    <Check size={14} className="text-emerald-600" />
                    <span>Zero Invisible White-Font or Hidden Text Layers</span>
                  </div>
                  <div className="check-item">
                    <Check size={14} className="text-emerald-600" />
                    <span>Chronological Timeline & Experience Verified</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Resume Viewer Modal */}
      {showResumeViewer && (
        <ResumeViewerModal
          candidate={c}
          onClose={() => setShowResumeViewer(false)}
        />
      )}
    </div>
  );
}
