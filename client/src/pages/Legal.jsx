import React from 'react';
import { Link } from 'react-router-dom';

export const LEGAL_EFFECTIVE = 'October 2026';
export const CONTACT_EMAIL = 'biomedacess@gmail.com';

function LegalShell({ title, children }) {
  return (
    <div className="container narrow">
      <div className="card legal">
        <h1>{title}</h1>
        <p className="muted small">Effective date: {LEGAL_EFFECTIVE}</p>
        {children}
        <p className="small muted mt">
          Questions about this page? Email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--blue)' }}>{CONTACT_EMAIL}</a>.
        </p>
        <p className="small mt">
          <Link to="/privacy" style={{ color: 'var(--blue)' }}>Privacy Policy</Link>
          {' · '}
          <Link to="/terms" style={{ color: 'var(--blue)' }}>Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        BiomedAccess is a biomedical sciences learning platform run from Zambia. This policy explains what we collect when
        you use the site, why we collect it, and what choices you have. We keep it short and plain on purpose.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name and email address when you sign up with email and password, or the name and email Google shares with us when you use "Continue with Google".</li>
        <li><strong>Learning activity:</strong> the courses and topics you enroll in or open, your quiz attempts and scores, case study answers, progress on topics, and posts or replies you make in communities.</li>
        <li><strong>Basic technical data:</strong> a login session token kept in your browser so you stay signed in, and standard server logs (such as time of request and error details) that help us keep the site running and fix problems.</li>
        <li><strong>Payments:</strong> paid courses are not yet live. When they are, payment will be handled by Stripe. We will not store your card details ourselves.</li>
      </ul>
      <p>We do not collect your location, contacts, or device identifiers for advertising, and we do not run advertising trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To create and run your account, and to sign you in.</li>
        <li>To save your progress, show your dashboard, and grade quizzes.</li>
        <li>To show community discussions and case studies under your name.</li>
        <li>To send you essential account messages, such as sign-in or account confirmations.</li>
        <li>To keep the platform secure, prevent abuse, and improve course content.</li>
      </ul>

      <h2>We do not sell your data</h2>
      <p>
        We do not sell your personal information, and we do not rent or trade it to advertisers or data brokers. We share
        data only with the service providers we need to run BiomedAccess (for example our hosting provider, Render, and
        Google when you sign in with Google), and only to the extent they need it to do that job. We may disclose information
        if the law requires it.
      </p>

      <h2>Your choices and account deletion</h2>
      <p>
        You can ask us to delete your account and the personal data we hold about you at any time by emailing{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--blue)' }}>{CONTACT_EMAIL}</a> from the address on your account.
        We will delete your account, profile, and linked learning records and confirm by email. Some anonymous,
        aggregated course statistics may be kept, but they cannot be linked back to you. You can also ask us for a copy of
        the personal data we hold about you.
      </p>

      <h2>Children</h2>
      <p>BiomedAccess is intended for adults and students in higher education or professional training. Do not create an account if you are under 16 without a parent or guardian's permission.</p>

      <h2>Security</h2>
      <p>
        Passwords are stored in hashed form, not as plain text. No online service is perfectly secure, so please use a strong
        unique password and tell us straight away if you think your account has been misused.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy in a way that matters, we will update the effective date above and, where appropriate, tell
        you on the site or by email.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms apply when you use BiomedAccess. By creating an account or using the site, you agree to them. If you do
        not agree, please do not use the site.
      </p>

      <h2>Educational content only, not medical or professional advice</h2>
      <p>
        BiomedAccess provides educational material for students and professionals, including courses, topics, quizzes, case
        studies, and community discussions. Nothing on the site is medical, clinical, diagnostic, or laboratory advice, and
        it does not replace your supervisor, a qualified clinician, your accredited laboratory's procedures, or your
        regulator's standards. Do not use anything you learn here to diagnose, treat, or make decisions about a patient
        without checking it against validated local protocols and a qualified professional. We do our best to keep content
        accurate, but it may contain errors or be out of date.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must give accurate information when you sign up and keep your sign-in details safe.</li>
        <li>You are responsible for activity on your account. Tell us if you think someone else has access to it.</li>
        <li>One person, one account. Do not share or sell accounts.</li>
        <li>You can delete your account at any time by emailing {CONTACT_EMAIL}. We can suspend or close accounts that break these terms.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>When you use BiomedAccess, you agree not to:</p>
      <ul>
        <li>post content that is abusive, hateful, sexually explicit, threatening, or harassing;</li>
        <li>share patient-identifiable information or confidential workplace data in communities or case studies;</li>
        <li>copy, resell, or redistribute course content, quizzes, or resources without written permission;</li>
        <li>try to break into the site, scrape it at scale, interfere with other users, or bypass access controls or paid content;</li>
        <li>impersonate another person or misrepresent your qualifications;</li>
        <li>use the site for anything unlawful.</li>
      </ul>
      <p>We may remove content and restrict accounts that break these rules.</p>

      <h2>Free and paid courses</h2>
      <p>
        Some courses are free. Paid courses are not yet available. When they are, prices, access periods, and refund rules will
        be shown before you pay, and payments will be processed by a third-party provider.
      </p>

      <h2>Content ownership</h2>
      <p>
        BiomedAccess and its course materials, quizzes, case studies, design, and software belong to BiomedAccess or its
        licensors. You may use them for your own personal learning. You keep the rights to content you post in communities
        and case studies, and you give BiomedAccess a non-exclusive licence to display that content on the site so the
        community can read it. You can ask us to remove your posts.
      </p>

      <h2>Availability and liability</h2>
      <p>
        BiomedAccess is provided as is. We aim to keep the site available but do not guarantee uninterrupted access. To the
        extent the law allows, BiomedAccess is not liable for indirect losses, or for any decision you make based on the
        educational content.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. When we do, we change the effective date above. If a change is significant, we will let
        you know on the site or by email. Continuing to use BiomedAccess after a change means you accept the updated terms.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Zambia.</p>
    </LegalShell>
  );
}
