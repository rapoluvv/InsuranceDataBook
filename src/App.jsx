import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearDraftSnapshot,
  exportRecords,
  importRecords,
  loadRecords,
  readDraftSnapshot,
  removeRecord,
  removeRecords,
  saveDraftSnapshot,
  saveRecord,
} from './lib/storage.js';
import { hasFirebaseConfig } from './lib/firebase.js';
import {
  createAccount,
  getAuthErrorMessage,
  getGuestSession,
  updateGuestDisplayName,
  signIn,
  signInAnonymouslyUser,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  updateUserDisplayName,
} from './lib/auth.js';

const ROLE_USERS = {
  agent: {
    id: 'agent-demo',
    name: 'Riya Menon',
    roleLabel: 'Agent',
    initials: 'RM',
  },
  customer: {
    id: 'customer-demo',
    name: 'Aarav Mehta',
    roleLabel: 'Customer',
    initials: 'AM',
  },
};

const DATA_PREFIX = 'databook';
const LEGACY_PREFIX = ['case', 'book'].join('');
const DEMO_PROFILE_KEY = `${DATA_PREFIX}-demo-profile-names-v1`;
const LEGACY_DEMO_PROFILE_KEY = `${LEGACY_PREFIX}-demo-profile-names-v1`;

function getInitials(name = 'Member') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good night';
}

function getViewFromHash() {
  if (typeof window === 'undefined') return 'overview';
  const candidate = window.location.hash.replace(/^#\/?/, '');
  return ['overview', 'records', 'form'].includes(candidate) ? candidate : 'overview';
}

function getInviteContext() {
  if (typeof window === 'undefined') {
    return { isInvite: false, inviteId: '', invitedById: '', invitedByName: '' };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    isInvite: params.get('invite') === '1',
    inviteId: params.get('inviteId') || '',
    invitedById: params.get('agentId') || '',
    invitedByName: params.get('agentName') || '',
  };
}

function getDemoProfileName(role) {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(DEMO_PROFILE_KEY)
      || window.localStorage.getItem(LEGACY_DEMO_PROFILE_KEY)
      || '{}',
    );
    return stored[role] || ROLE_USERS[role].name;
  } catch (error) {
    console.error('Unable to read the demo profile name.', error);
    return ROLE_USERS[role].name;
  }
}

function saveDemoProfileName(role, name) {
  const stored = JSON.parse(window.localStorage.getItem(DEMO_PROFILE_KEY) || '{}');
  window.localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ ...stored, [role]: name }));
}

const STEPS = [
  { id: 'applicant', label: 'Applicant', hint: 'Identity' },
  { id: 'contact', label: 'Contact', hint: 'Reachability' },
  { id: 'work', label: 'Work & income', hint: 'Background' },
  { id: 'plan', label: 'Proposed plan', hint: 'Policy' },
  { id: 'nominee', label: 'Nominee', hint: 'Beneficiary' },
  { id: 'bank', label: 'Bank details', hint: 'Payment' },
  { id: 'family', label: 'Family & health', hint: 'Declarations' },
  { id: 'previous', label: 'Previous policies', hint: 'History' },
  { id: 'review', label: 'Review', hint: 'Submit' },
];

const STATE_OPTIONS = [
  'Andhra Pradesh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
];

function createInitialForm() {
  return {
    fullName: '',
    proposerName: '',
    dateOfBirth: '',
    age: '',
    aadhaar: '',
    pan: '',
    ckyc: '',
    abha: '',
    fatherName: '',
    motherName: '',
    gender: '',
    maritalStatus: '',
    spouseName: '',
    marriageDate: '',

    mobileAadhaar: '',
    mobile: '',
    whatsapp: '',
    email: '',
    birthPlace: '',
    residentialStatus: 'Resident Indian',
    corrSameKyc: false,
    address: '',
    corrAddress: '',
    city: '',
    state: '',
    pincode: '',

    education: '',
    occupation: '',
    typeOfDuty: '',
    employer: '',
    since: '',
    totalExperience: '',
    annualIncome: '',
    lyIncome1: '',
    lyIncome2: '',
    lyIncome3: '',
    husbandOccupation: '',
    husbandAnnualIncome: '',

    planName: '',
    planNumber: '',
    policyTerm: '',
    ppt: '',
    premiumMode: 'Yearly',
    sumAssured: '',
    accidentalBenefit: '',
    termRider: 'No',
    premium: '',
    datingBack: 'No',
    datingBackDate: '',
    pwb: 'No',
    bocNumber: '',
    bocDate: '',
    bocAmount: '',
    commencementDate: '',

    nominees: [{ name: '', relation: '', share: '100', dob: '', age: '', aadhaar: '', phone: '' }],
    appointeeName: '',
    appointeeRelation: '',
    appointeeAge: '',

    bankName: '',
    accountType: '',
    accountHolderName: '',
    bankAddress: '',
    accountNumber: '',
    ifsc: '',
    micr: '',

    fatherAge: '',
    fatherHealth: 'Good',
    fatherDiedAge: '',
    fatherDiedYear: '',
    fatherDiedCause: '',

    motherAge: '',
    motherHealth: 'Good',
    motherDiedAge: '',
    motherDiedYear: '',
    motherDiedCause: '',

    spouseAge: '',
    spouseHealth: 'Good',
    spouseDiedAge: '',
    spouseDiedYear: '',
    spouseDiedCause: '',

    siblings: [],
    children: [],

    height: '',
    weight: '',
    abdomen: '',
    operations: 'No',
    operationsDetails: '',
    disease: 'No',
    diseaseDetails: '',
    pregnancy: 'No',
    lastDelivery: '',

    previousPolicies: [],
  };
}

function digitsOnly(value, maxLength) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength);
}

function formatAadhaar(value) {
  return digitsOnly(value, 12).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatPan(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

function formatMobile(value) {
  return digitsOnly(value, 10);
}

function formatIfsc(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
}

function formatMicr(value) {
  return digitsOnly(value, 9);
}

function isValidAadhaar(value) {
  return /^\d{4}\s\d{4}\s\d{4}$/.test(String(value || ''));
}

function isValidPan(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value || ''));
}

function isValidIndianMobile(value) {
  return /^[6-9]\d{9}$/.test(String(value || ''));
}

function isValidIfsc(value) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(value || ''));
}

function isValidMicr(value) {
  return /^\d{9}$/.test(String(value || ''));
}

function normalizeFieldValue(field, value) {
  switch (field) {
    case 'aadhaar':
      return formatAadhaar(value);
    case 'pan':
      return formatPan(value);
    case 'mobileAadhaar':
    case 'mobile':
    case 'whatsapp':
    case 'phone':
      return formatMobile(value);
    case 'ifsc':
      return formatIfsc(value);
    case 'micr':
      return formatMicr(value);
    default:
      return value;
  }
}

function normalizeForm(formData = {}) {
  const initial = createInitialForm();
  return {
    ...initial,
    ...formData,
    aadhaar: formatAadhaar(formData.aadhaar),
    pan: formatPan(formData.pan),
    mobileAadhaar: formatMobile(formData.mobileAadhaar),
    mobile: formatMobile(formData.mobile),
    whatsapp: formatMobile(formData.whatsapp),
    ifsc: formatIfsc(formData.ifsc),
    micr: formatMicr(formData.micr),
    nominees: Array.isArray(formData.nominees) && formData.nominees.length
      ? formData.nominees.map((n) => ({
          name: n.name || '',
          relation: n.relation || '',
          share: String(n.share ?? '100'),
          dob: n.dob || '',
          age: n.dob ? calculateAge(n.dob) : n.age || '',
          aadhaar: formatAadhaar(n.aadhaar),
          phone: formatMobile(n.phone || n.mobile),
        }))
      : initial.nominees,
    siblings: Array.isArray(formData.siblings) ? formData.siblings.map((s) => ({
      relation: s.relation || 'Brother',
      age: s.age || '',
      health: s.health || 'Good',
      diedAge: s.diedAge || '',
      diedYear: s.diedYear || '',
      diedCause: s.diedCause || '',
    })) : [],
    children: Array.isArray(formData.children) ? formData.children.map((c) => ({
      age: c.age || '',
      health: c.health || 'Good',
      diedAge: c.diedAge || '',
      diedYear: c.diedYear || '',
      diedCause: c.diedCause || '',
    })) : [],
    previousPolicies: Array.isArray(formData.previousPolicies) ? formData.previousPolicies.map((p) => ({
      policyNumber: p.policyNumber || '',
      branch: p.branch || '',
      planTerm: p.planTerm || '',
      sumAssured: p.sumAssured || '',
      premium: p.premium || '',
      mode: p.mode || 'Yearly',
      accidentalBenefit: p.accidentalBenefit || '',
      commencementDate: p.commencementDate || '',
      rateAccepted: p.rateAccepted || 'Ordinary Rate',
      medicalType: p.medicalType || 'Medical',
      inforce: p.inforce || 'Yes',
    })) : [],
  };
}

function calculateAge(dateValue) {
  if (!dateValue) return '';
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return '';

  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return '';
  if (years === 0 && months === 0) return `${days} Days`;
  if (years === 0) return `${months} Months, ${days} Days`;
  return `${years} Years, ${months} Months, ${days} Days`;
}

function formatMoney(value) {
  const numericValue = Number(value);
  if (!numericValue) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDate(value) {
  const timestamp = getDateTimestamp(value);
  if (timestamp === null) return 'No date';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getDateTimestamp(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getImportOrder(record) {
  return Number.isInteger(record.importOrder) ? record.importOrder : Number.MAX_SAFE_INTEGER;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createRecordId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createCaseNumber() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CASE-${datePart}-${randomPart}`;
}

function hasFormContent(form) {
  return Boolean(
    form.fullName ||
    form.mobileAadhaar ||
    form.mobile ||
    form.email ||
    form.occupation ||
    form.planName ||
    form.sumAssured ||
    form.premium,
  );
}

function validateStep(stepIndex, form) {
  const errors = {};
  const required = (field, message) => {
    if (!String(form[field] || '').trim()) errors[field] = message;
  };

  if (stepIndex === 0) {
    required('fullName', 'Add the applicant name.');
    required('gender', 'Choose a gender.');
    required('maritalStatus', 'Choose marital status.');
    required('aadhaar', 'Add the Aadhaar number.');
    if (form.aadhaar && !isValidAadhaar(form.aadhaar)) {
      errors.aadhaar = 'Enter a valid 12-digit Aadhaar number.';
    }
    if (form.pan && !isValidPan(form.pan)) {
      errors.pan = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
    }
    if ((form.maritalStatus === 'Married' || form.maritalStatus === 'Yes') && !String(form.spouseName || '').trim()) {
      errors.spouseName = 'Add the spouse name.';
    }
  }

  if (stepIndex === 1) {
    required('mobileAadhaar', 'Add the Aadhaar-linked mobile number.');
    if (form.mobileAadhaar && !isValidIndianMobile(form.mobileAadhaar)) {
      errors.mobileAadhaar = 'Use a 10-digit Indian mobile number beginning with 6-9.';
    }
    if (form.mobile && !isValidIndianMobile(form.mobile)) {
      errors.mobile = 'Use a 10-digit Indian mobile number beginning with 6-9.';
    }
    if (form.whatsapp && !isValidIndianMobile(form.whatsapp)) {
      errors.whatsapp = 'Use a 10-digit Indian mobile number beginning with 6-9.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Check the email format.';
    }
    required('dateOfBirth', 'Add the date of birth.');
  }

  if (stepIndex === 2) {
    required('occupation', 'Add the current occupation.');
    required('annualIncome', 'Add the annual income.');
  }

  if (stepIndex === 3) {
    required('planName', 'Add a plan name / term.');
    required('sumAssured', 'Add the sum assured.');
    required('premium', 'Add the premium.');
    required('premiumMode', 'Choose a premium mode.');
    if (form.datingBack === 'Yes' && !String(form.datingBackDate || '').trim()) {
      errors.datingBackDate = 'Add the dating back date.';
    }
  }

  if (stepIndex === 4) {
    const shareTotal = form.nominees.reduce((total, nominee) => total + Number(nominee.share || 0), 0);
    if (!form.nominees.length) {
      errors.nominees = 'Add at least one nominee.';
    } else if (Math.round(shareTotal) !== 100) {
      errors.nominees = `Nominee shares currently total ${shareTotal}%. They must total 100%.`;
    }
    form.nominees.forEach((nominee, index) => {
      if (!String(nominee.name || '').trim()) errors[`nominee-${index}-name`] = 'Add a nominee name.';
      if (!String(nominee.relation || '').trim()) errors[`nominee-${index}-relation`] = 'Choose a relation.';
      if (nominee.aadhaar && !isValidAadhaar(nominee.aadhaar)) {
        errors[`nominee-${index}-aadhaar`] = 'Enter a valid 12-digit Aadhaar number.';
      }
      if (nominee.phone && !isValidIndianMobile(nominee.phone)) {
        errors[`nominee-${index}-phone`] = 'Use a 10-digit Indian mobile number beginning with 6-9.';
      }
    });
  }

  if (stepIndex === 5) {
    if (form.ifsc && !isValidIfsc(form.ifsc)) {
      errors.ifsc = 'IFSC code should be 11 characters (e.g. HDFC0001234).';
    }
    if (form.micr && !isValidMicr(form.micr)) {
      errors.micr = 'MICR code should be exactly 9 digits.';
    }
  }

  if (stepIndex === 6) {
    if (form.fatherHealth === 'Dead') {
      if (!String(form.fatherDiedAge || '').trim()) errors.fatherDiedAge = 'Enter age at death.';
      if (!String(form.fatherDiedYear || '').trim()) errors.fatherDiedYear = 'Enter death year.';
      if (!String(form.fatherDiedCause || '').trim()) errors.fatherDiedCause = 'Enter cause of death.';
    }
    if (form.motherHealth === 'Dead') {
      if (!String(form.motherDiedAge || '').trim()) errors.motherDiedAge = 'Enter age at death.';
      if (!String(form.motherDiedYear || '').trim()) errors.motherDiedYear = 'Enter death year.';
      if (!String(form.motherDiedCause || '').trim()) errors.motherDiedCause = 'Enter cause of death.';
    }
    if ((form.maritalStatus === 'Married' || form.maritalStatus === 'Yes') && form.spouseHealth === 'Dead') {
      if (!String(form.spouseDiedAge || '').trim()) errors.spouseDiedAge = 'Enter age at death.';
      if (!String(form.spouseDiedYear || '').trim()) errors.spouseDiedYear = 'Enter death year.';
      if (!String(form.spouseDiedCause || '').trim()) errors.spouseDiedCause = 'Enter cause of death.';
    }
    if (form.operations === 'Yes' && !String(form.operationsDetails || '').trim()) {
      errors.operationsDetails = 'Enter details of operations.';
    }
    if (form.disease === 'Yes' && !String(form.diseaseDetails || '').trim()) {
      errors.diseaseDetails = 'Enter details of diseases.';
    }
  }

  return errors;
}

function validateAll(form) {
  return STEPS.slice(0, -1).reduce((allErrors, _step, index) => {
    return { ...allErrors, ...validateStep(index, form) };
  }, {});
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    file: <><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    link: <><path d="m10 13 4-4" /><path d="M7.5 16.5 6 18a3.2 3.2 0 0 1-4.5-4.5l3-3a3.2 3.2 0 0 1 4.5 0M16.5 7.5 18 6A3.2 3.2 0 0 0 13.5 1.5l-3 3a3.2 3.2 0 0 0 0 4.5" /></>,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <><path d="m15 5-7 7 7 7" /><path d="M8 12h11" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    check: <path d="m5 12 4.2 4.2L19 6.5" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
    shield: <><path d="M12 3.5 19 6v5.3c0 4.3-2.5 7.8-7 9.2-4.5-1.4-7-4.9-7-9.2V6z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><path d="M16 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H7.7A3.7 3.7 0 0 0 4 18.2V20" /><circle cx="10" cy="7.5" r="3.3" /><path d="M16 4.5a3.3 3.3 0 0 1 0 6.4M20 20v-1.8a3.7 3.7 0 0 0-2.8-3.6" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 20h16" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5M4 20h16" /></>,
    edit: <><path d="m4 16.5-.8 3.4 3.4-.8L18.8 7a2.4 2.4 0 0 0-3.4-3.4z" /><path d="m13.5 5.5 3 3" /></>,
    trash: <><path d="M4.5 7h15M9 7V4.5h6V7M7 7l.8 13h8.4L17 7M10 11v5M14 11v5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5M12 7.5h.01" /></>,
    sort: <><path d="m8 9 4-4 4 4M16 15l-4 4-4-4" /></>,
    sortUp: <path d="m8 14 4-4 4 4" />,
    sortDown: <path d="m8 10 4-4 4 4" style={{ transform: 'rotate(180deg)', transformOrigin: 'center' }} />,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths[name] || paths.info}
    </svg>
  );
}

function AuthLoading() {
  return (
    <main className="auth-screen">
      <div className="auth-panel auth-loading">
        <span className="auth-mark" aria-hidden="true"><span /></span>
        <span className="loading-line" />
        <p>Checking your workspace…</p>
      </div>
    </main>
  );
}

function SignInView({ error, isSigningIn, onClearError, onContinueGuest, onGoogleSignIn, onSignIn, onSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [localError, setLocalError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setLocalError('');
    if (!isSignUp) {
      onSignIn(email, password);
      return;
    }
    if (displayName.trim().length < 2) {
      setLocalError('Enter the name you want shown in your workspace.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Use a password with at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('The passwords do not match.');
      return;
    }
    onSignUp(email, password, displayName.trim());
  }

  async function handleGoogleSignIn() {
    try {
      await onGoogleSignIn();
    } catch {
      // The parent stores the provider error in the shared auth state.
    }
  }

  function switchAccountMode(nextIsSignUp) {
    setIsSignUp(nextIsSignUp);
    setLocalError('');
    setConfirmPassword('');
    onClearError();
  }

  const visibleError = localError || error;

  return (
    <main className="auth-screen auth-variant-split-case">
      <aside className="auth-side" aria-label="Databook overview">
        <div className="auth-side-brand">
          <span className="auth-mark" aria-hidden="true"><span /></span>
          <div><strong>databook</strong><small>insurance data</small></div>
        </div>
        <div className="auth-side-copy">
          <span className="auth-side-kicker">Secure intake</span>
          <h2>A careful record begins with a clear first step.</h2>
          <p>One guided workspace for the details that help a customer and agent move with confidence.</p>
        </div>
        <div className="auth-score" aria-label="Databook workflow">
          <div className="auth-score-row"><span className="auth-score-marker">01</span><span><strong>Private identity</strong><small>Protected by role</small></span><Icon name="shield" size={16} /></div>
          <div className="auth-score-row"><span className="auth-score-marker">02</span><span><strong>Guided intake</strong><small>Clear, reviewable steps</small></span><Icon name="check" size={16} /></div>
          <div className="auth-score-row"><span className="auth-score-marker">03</span><span><strong>Agent review</strong><small>Ready when the case is</small></span><Icon name="arrow" size={16} /></div>
        </div>
        <p className="auth-side-footer">The case score keeps every important detail in view.</p>
      </aside>
      <section className="auth-panel" aria-labelledby="sign-in-title">
        <div className="auth-panel-content">
          <div className="auth-panel-intro">
            <div className="auth-copy">
              <span className="auth-kicker">Secure workspace</span>
              <h1 id="sign-in-title">{isSignUp ? 'Create your Databook account.' : 'Sign in to your Databook.'}</h1>
              <p>{isSignUp ? 'Create a secure account to return to your records across devices.' : 'Use the account created for your role. Customer records stay private; agents see the full submission queue.'}</p>
            </div>
          </div>
          <div className="auth-panel-methods">
            <button className="button button-secondary auth-google-button" disabled={isSigningIn} onClick={handleGoogleSignIn} type="button">
              <span className="google-mark" aria-hidden="true">G</span>
              Continue with Google
              <Icon name="arrow" size={16} />
            </button>
            <div className="auth-divider"><span>or use</span></div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignUp && <Field label="Display name" name="auth-display-name" onChange={(_, value) => setDisplayName(value)} placeholder="How should we greet you?" required value={displayName} />}
              <Field label="Email address" name="auth-email" onChange={(_, value) => setEmail(value)} placeholder="you@example.com" required type="email" value={email} />
              <Field helper={isSignUp ? 'At least 6 characters.' : ''} label="Password" name="auth-password" onChange={(_, value) => setPassword(value)} placeholder="Your password" required type="password" value={password} />
              {isSignUp && <Field label="Confirm password" name="auth-confirm-password" onChange={(_, value) => setConfirmPassword(value)} placeholder="Repeat your password" required type="password" value={confirmPassword} />}
              {visibleError && <div className="auth-error" role="alert"><Icon name="info" size={16} />{visibleError}</div>}
              <button className="button button-primary auth-submit" disabled={isSigningIn || !email || !password || (isSignUp && (!displayName || !confirmPassword))} type="submit">
                {isSigningIn ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
                {!isSigningIn && <Icon name="arrow" size={16} />}
              </button>
            </form>
          </div>
          <div className="auth-panel-footer">
            <div className="auth-account-switch">
              <span>{isSignUp ? 'Already have an account?' : 'New to Databook?'}</span>
              <button className="text-button" onClick={() => switchAccountMode(!isSignUp)} type="button">{isSignUp ? 'Sign in' : 'Create an account'}</button>
            </div>
            <div className="auth-guest-row">
              <span>{isSignUp ? 'Prefer not to create an account?' : 'Prefer not to sign in?'}</span>
              <button className="text-button auth-guest-link" onClick={onContinueGuest} type="button">Continue as guest <Icon name="arrow" size={15} /></button>
            </div>
            <p className="auth-guest-note">Drafts stay in this browser. Submit to your agent through anonymous Firebase access.</p>
            <p className="auth-note"><Icon name="shield" size={15} /> Registered users are customers unless an agent claim is assigned server-side.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProfileEditor({ error, isSaving, name, onCancel, onChange, onSave }) {
  return (
    <div className="profile-popover" role="dialog" aria-labelledby="profile-editor-title">
      <span className="profile-kicker">Workspace profile</span>
      <h2 id="profile-editor-title">How should we greet you?</h2>
      <p>Choose the name shown in your workspace greeting.</p>
      <form onSubmit={onSave}>
        <label htmlFor="profile-display-name">Display name</label>
        <input
          autoFocus
          id="profile-display-name"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Your name"
          value={name}
        />
        {error && <span className="profile-error" role="alert">{error}</span>}
        <div className="profile-actions">
          <button className="profile-cancel" onClick={onCancel} type="button">Cancel</button>
          <button className="profile-save" disabled={isSaving || !name.trim()} type="submit">{isSaving ? 'Saving…' : 'Save name'}</button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  helper = '',
  error = '',
  readOnly = false,
  disabled = false,
  inputMode,
  maxLength,
  pattern,
  min,
  max,
  step,
}) {
  const inputId = `field-${name}`;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <input
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        inputMode={inputMode}
        max={max}
        maxLength={maxLength}
        min={min}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        pattern={pattern}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        step={step}
        type={type}
        value={value ?? ''}
      />
      {helper && !error && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
      {error && <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}

function SelectField({ name, label, value, onChange, options, required = false, helper = '', error = '' }) {
  const inputId = `field-${name}`;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <select
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        aria-invalid={Boolean(error)}
        id={inputId}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        value={value ?? ''}
      >
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {helper && !error && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
      {error && <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}

function TextAreaField({ name, label, value, onChange, placeholder = '', helper = '', error = '', readOnly = false, disabled = false, required = false }) {
  const inputId = `field-${name}`;
  return (
    <div className={`field field-wide ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true">*</span>}
      </label>
      <textarea
        aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={inputId}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        rows="3"
        value={value ?? ''}
      />
      {helper && !error && <p className="field-helper" id={`${inputId}-helper`}>{helper}</p>}
      {error && <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p>}
    </div>
  );
}

function CheckboxField({ name, label, checked, onChange, helper = '' }) {
  const inputId = `field-${name}`;
  return (
    <div className="field-checkbox">
      <label className="checkbox-label" htmlFor={inputId}>
        <input
          checked={Boolean(checked)}
          id={inputId}
          name={name}
          onChange={(event) => onChange(name, event.target.checked)}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
      {helper && <p className="field-helper">{helper}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const label = status === 'draft' ? 'Draft' : 'Submitted';
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function StepRail({ activeStep, highestStep, onStepChange }) {
  return (
    <nav className="step-rail" aria-label="Form progress">
      <div className="staff-line" aria-hidden="true" />
      <div className="step-rail-heading">
        <span>Case score</span>
        <strong>{String(activeStep + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</strong>
      </div>
      <div className="step-list">
        {STEPS.map((step, index) => {
          const completed = index < activeStep;
          const available = index <= highestStep;
          return (
            <button
              aria-current={index === activeStep ? 'step' : undefined}
              className={`step-button ${index === activeStep ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`}
              disabled={!available}
              key={step.id}
              onClick={() => onStepChange(index)}
              type="button"
            >
              <span className="step-marker" aria-hidden="true">
                {completed ? <Icon name="check" size={14} /> : <span>{String(index + 1).padStart(2, '0')}</span>}
              </span>
              <span className="step-copy">
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </span>
              {index === activeStep && <Icon name="chevron" size={15} />}
            </button>
          );
        })}
      </div>
      <div className="step-rail-note">
        <Icon name="shield" size={16} />
        <span>Private by role. Customers see only their own records.</span>
      </div>
    </nav>
  );
}

function SectionHeading({ title, description, number }) {
  return (
    <div className="section-heading">
      <div>
        <span className="section-number">{number}</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function ActivityChart({ records }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
  const activity = days.map((date) => {
    const dateKey = getDateKey(date);
    const updates = records.filter((record) => getDateKey(new Date(record.updatedAt)) === dateKey);
    return {
      date,
      submitted: updates.filter((record) => record.status === 'submitted').length,
      drafts: updates.filter((record) => record.status === 'draft').length,
    };
  });
  const maxValue = Math.max(1, ...activity.map((day) => Math.max(day.submitted, day.drafts)));
  const totalUpdates = activity.reduce((sum, day) => sum + day.submitted + day.drafts, 0);
  const chart = { width: 460, height: 175, left: 27, right: 13, top: 15, bottom: 31 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const xFor = (index) => chart.left + (index * plotWidth) / (activity.length - 1);
  const yFor = (value) => chart.top + plotHeight - (value / maxValue) * plotHeight;
  const pointsFor = (key) => activity.map((day, index) => `${xFor(index)},${yFor(day[key])}`).join(' ');
  const formatDay = (date) => new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date).slice(0, 3);

  return (
    <aside className="surface-panel chart-panel" aria-labelledby="activity-title">
      <div className="panel-heading">
        <div>
          <h2 id="activity-title">Case activity</h2>
          <p>Updates across the last seven days.</p>
        </div>
        <div className="chart-total">
          <strong>{totalUpdates}</strong>
          <span>updates</span>
        </div>
      </div>
      <div className="chart-wrap">
        <svg
          aria-labelledby="activity-chart-title activity-chart-description"
          className="activity-chart"
          role="img"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
        >
          <title id="activity-chart-title">Submitted and draft case activity</title>
          <desc id="activity-chart-description">A seven-day line chart showing submitted and draft record updates.</desc>
          {[0, 0.5, 1].map((position) => {
            const y = chart.top + plotHeight * position;
            return <line className="chart-grid-line" key={position} x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} />;
          })}
          <text className="chart-scale" x="3" y={chart.top + 3}>{maxValue}</text>
          <text className="chart-scale" x="9" y={chart.top + plotHeight + 3}>0</text>
          <polyline className="chart-submitted-line" points={pointsFor('submitted')} />
          <polyline className="chart-draft-line" points={pointsFor('drafts')} />
          {activity.map((day, index) => (
            <g key={getDateKey(day.date)}>
              <circle className="chart-point chart-point-submitted" cx={xFor(index)} cy={yFor(day.submitted)} r="3.5" />
              <circle className="chart-point chart-point-draft" cx={xFor(index)} cy={yFor(day.drafts)} r="3.5" />
              <text className="chart-label" textAnchor="middle" x={xFor(index)} y={chart.height - 8}>{formatDay(day.date)}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-footer">
        <div className="chart-legend">
          <span><i className="legend-swatch legend-submitted" />Submitted</span>
          <span><i className="legend-swatch legend-draft" />Drafts</span>
        </div>
        <span className="chart-note">{totalUpdates ? 'A clear view of recent movement.' : 'No updates in this window.'}</span>
      </div>
    </aside>
  );
}

function OverviewView({ role, user, records, currentTime, isGuest, isAnonymousGuest, onCopyInviteLink, onExitGuest, onStartNew, onContinueDraft, onViewRecords, browserDraft }) {
  const submitted = records.filter((record) => record.status === 'submitted');
  const drafts = records.filter((record) => record.status === 'draft');
  const totalPremium = submitted.reduce((sum, record) => sum + Number(record.premium || 0), 0);
  const latestRecords = records.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 4);
  const isAgent = role === 'agent';

  return (
    <div className="page-view overview-view">
      <header className="view-header">
        <div>
          <h1>{isAgent ? 'Your databook' : 'Your submissions'}</h1>
          <p>{isAgent ? 'A clear working view of every customer record in motion.' : 'Pick up where you left off or review a submitted record.'}</p>
        </div>
        <div className="view-header-actions">
          {isAgent && <button className="button button-secondary" onClick={onCopyInviteLink} type="button"><Icon name="share" size={16} /> Share customer link</button>}
          <button className="button button-primary" onClick={onStartNew} type="button"><Icon name="plus" size={17} /> New intake</button>
        </div>
      </header>

      {isGuest && (
        <div className="guest-banner" role="status">
          <span className="guest-mark"><Icon name="info" size={15} /></span>
          <span>
            <strong>{isAnonymousGuest ? 'Guest submission.' : 'Guest mode.'}</strong>{' '}
            {isAnonymousGuest
              ? 'Submitted records sync securely to your agent through this temporary browser session.'
              : 'Drafts stay in this browser. Submitting a record creates a temporary anonymous account so your agent can review it.'}
          </span>
          <button className="text-button" onClick={onExitGuest} type="button">Sign in instead <Icon name="arrow" size={15} /></button>
        </div>
      )}

      {!hasFirebaseConfig && !isGuest && (
        <div className="demo-banner" role="status">
          <span className="demo-mark"><Icon name="info" size={15} /></span>
          <span><strong>Demo workspace.</strong> Add Firebase environment values to sync authentication and records across devices.</span>
        </div>
      )}

      <section className="welcome-band" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="welcome-mark" aria-hidden="true"><span /></span>
          <div>
            <h2 id="welcome-title">{getGreeting(currentTime)}, {user.name}.</h2>
            <p>{isAgent ? 'The next careful entry is usually the one that keeps a case moving.' : 'Your information stays together from first detail to final review.'}</p>
          </div>
        </div>
        <div className="welcome-action">
          {browserDraft ? (
            <>
              <span className="mini-status"><Icon name="clock" size={14} /> Unsaved form found</span>
              <button className="text-button" onClick={onContinueDraft} type="button">Continue draft <Icon name="arrow" size={15} /></button>
            </>
          ) : (
            <span className="mini-status"><Icon name="shield" size={14} /> {isAgent ? 'Agent view' : 'Customer view'}</span>
          )}
        </div>
      </section>

      <section className="metric-strip" aria-label="Workspace summary">
        <div className="metric">
          <span className="metric-label">{isAgent ? 'All submissions' : 'Your submissions'}</span>
          <strong>{records.length}</strong>
          <span className="metric-note">records in scope</span>
        </div>
        <div className="metric">
          <span className="metric-label">Open drafts</span>
          <strong>{drafts.length}</strong>
          <span className="metric-note">ready to continue</span>
        </div>
        <div className="metric">
          <span className="metric-label">Submitted</span>
          <strong>{submitted.length}</strong>
          <span className="metric-note">through review</span>
        </div>
        <div className="metric metric-accent">
          <span className="metric-label">Premium in view</span>
          <strong>{formatMoney(totalPremium)}</strong>
          <span className="metric-note">annualized total</span>
        </div>
      </section>

      <div className="overview-columns">
        <section className="surface-panel recent-panel" aria-labelledby="recent-title">
          <div className="panel-heading">
            <div>
              <h2 id="recent-title">Recent movement</h2>
              <p>Latest changes across the case score.</p>
            </div>
            <button className="text-button" onClick={onViewRecords} type="button">View all <Icon name="arrow" size={15} /></button>
          </div>
          <div className="recent-list">
            {latestRecords.map((record) => (
              <button className="recent-row" key={record.id} onClick={onViewRecords} type="button">
                <span className="record-index">{(record.caseNumber || record.id).slice(-2)}</span>
                <span className="recent-main">
                  <strong>{record.applicantName || 'Unnamed applicant'}</strong>
                  <small>{record.planName || 'Plan not selected'} · {formatDate(record.updatedAt)}</small>
                </span>
                <span className="recent-value">
                  <StatusBadge status={record.status} />
                  <strong>{formatMoney(record.premium)}</strong>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
            {!latestRecords.length && <p className="empty-copy">No records yet. Start the first intake to create your case score.</p>}
          </div>
        </section>
        <ActivityChart records={records} />
      </div>
    </div>
  );
}

function RecordsView({
  role,
  records,
  isGuest,
  isAnonymousGuest,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onEdit,
  onOpen,
  onDelete,
  onDeleteMultiple,
  onExport,
  onImport,
  onStartNew,
}) {
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = records.filter((record) => {
      const docVal = record.formData?.commencementDate || record.formData?.doc || record.commencementDate || '';
      const matchesSearch = !query || [
        record.caseNumber,
        record.id,
        record.applicantName,
        record.planName,
        record.ownerName,
        record.submittedByName,
        record.submittedByEmail,
        docVal,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return [...matched].sort((a, b) => {
      let aVal;
      let bVal;

      switch (sortField) {
        case 'submittedAt': {
          const aSubmittedAt = getDateTimestamp(a.submittedAt);
          const bSubmittedAt = getDateTimestamp(b.submittedAt);

          if (aSubmittedAt === null && bSubmittedAt === null) {
            const aImportOrder = getImportOrder(a);
            const bImportOrder = getImportOrder(b);
            if (aImportOrder < bImportOrder) return -1;
            if (aImportOrder > bImportOrder) return 1;
            return 0;
          }
          if (aSubmittedAt === null) return 1;
          if (bSubmittedAt === null) return -1;

          aVal = aSubmittedAt;
          bVal = bSubmittedAt;
          break;
        }
        case 'doc': {
          const aDoc = a.formData?.commencementDate || a.formData?.doc || a.commencementDate || '';
          const bDoc = b.formData?.commencementDate || b.formData?.doc || b.commencementDate || '';
          aVal = aDoc ? new Date(aDoc).getTime() : 0;
          bVal = bDoc ? new Date(bDoc).getTime() : 0;
          break;
        }
        case 'applicant':
          aVal = (a.applicantName || '').toLowerCase();
          bVal = (b.applicantName || '').toLowerCase();
          break;
        case 'premium':
          aVal = Number(a.premium) || 0;
          bVal = Number(b.premium) || 0;
          break;
        case 'sumAssured':
          aVal = Number(a.sumAssured) || 0;
          bVal = Number(b.sumAssured) || 0;
          break;
        case 'planName':
          aVal = (a.planName || '').toLowerCase();
          bVal = (b.planName || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'updatedAt':
        default:
          aVal = new Date(a.updatedAt || a.submittedAt || 0).getTime();
          bVal = new Date(b.updatedAt || b.submittedAt || 0).getTime();
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, search, statusFilter, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstRecordIndex = filteredRecords.length ? (currentPage - 1) * pageSize : 0;
  const lastRecordIndex = Math.min(firstRecordIndex + pageSize, filteredRecords.length);
  const paginatedRecords = filteredRecords.slice(firstRecordIndex, lastRecordIndex);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortField, sortDirection, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  // Clean up selection when records or filters change
  const allFilteredIds = useMemo(() => filteredRecords.map((r) => r.id), [filteredRecords]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  function handleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  }

  function handleToggleRow(id, event) {
    event.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(`Permanently delete ${count} selected ${count === 1 ? 'record' : 'records'}? This cannot be undone.`);
    if (!confirmed) return;
    onDeleteMultiple?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  function handleSortToggle(field) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'applicant' || field === 'planName' || field === 'status' ? 'asc' : 'desc');
    }
  }

  function renderSortIcon(field) {
    if (sortField !== field) {
      return <Icon name="sort" size={13} />;
    }
    return sortDirection === 'asc' ? <Icon name="sortUp" size={13} /> : <Icon name="sortDown" size={13} />;
  }

  return (
    <div className="page-view records-view">
      <header className="view-header">
        <div>
          <h1>{role === 'agent' ? 'All submissions' : 'My submissions'}</h1>
          <p>{role === 'agent' ? 'Every customer record, in one reviewable line of sight.' : 'Your drafts and submitted policy information.'}</p>
        </div>
        <button className="button button-primary" onClick={onStartNew} type="button">
          <Icon name="plus" size={17} />
          New intake
        </button>
      </header>

      <div className="records-toolbar">
        <div className="search-field">
          <Icon name="search" size={17} />
          <label className="visually-hidden" htmlFor="record-search">Search records</label>
          <input
            id="record-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, case ID, plan, or DOC"
            type="search"
            value={search}
          />
        </div>
        <div className="toolbar-actions">
          <div className="filter-select">
            <Icon name="filter" size={16} />
            <label className="visually-hidden" htmlFor="status-filter">Filter by status</label>
            <select id="status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All status</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Drafts</option>
            </select>
          </div>

          <div className="filter-select sort-select">
            <Icon name="sort" size={15} />
            <label className="visually-hidden" htmlFor="sort-select-input">Sort records</label>
            <select
              id="sort-select-input"
              onChange={(e) => {
                const [f, d] = e.target.value.split(':');
                setSortField(f);
                setSortDirection(d);
              }}
              value={`${sortField}:${sortDirection}`}
            >
              <option value="submittedAt:desc">Submitted (Newest first)</option>
              <option value="submittedAt:asc">Submitted (Oldest first)</option>
              <option value="doc:desc">DOC (Latest first)</option>
              <option value="doc:asc">DOC (Earliest first)</option>
              <option value="updatedAt:desc">Updated (Newest first)</option>
              <option value="updatedAt:asc">Updated (Oldest first)</option>
              <option value="applicant:asc">Applicant (A-Z)</option>
              <option value="applicant:desc">Applicant (Z-A)</option>
              <option value="premium:desc">Premium (High to Low)</option>
              <option value="premium:asc">Premium (Low to High)</option>
              <option value="sumAssured:desc">Sum Assured (High to Low)</option>
              <option value="sumAssured:asc">Sum Assured (Low to High)</option>
              <option value="status:asc">Status</option>
            </select>
          </div>

          <button className="button button-quiet" onClick={onExport} type="button">
            <Icon name="download" size={16} />
            Export
          </button>
          <label className="button button-quiet file-button">
            <Icon name="upload" size={16} />
            Import
            <input accept="application/json" onChange={onImport} type="file" />
          </label>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-action-bar" role="region" aria-label="Bulk actions">
          <div className="bulk-action-info">
            <span className="bulk-count">{selectedIds.size}</span>
            <span>{selectedIds.size === 1 ? 'record selected' : 'records selected'}</span>
          </div>
          <div className="bulk-action-buttons">
            <button
              className="button button-secondary button-small"
              onClick={() => setSelectedIds(new Set())}
              type="button"
            >
              Clear selection
            </button>
            <button
              className="button button-danger button-small"
              onClick={handleBulkDelete}
              type="button"
            >
              <Icon name="trash" size={15} />
              Delete selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      <div className="records-meta">
        <span><strong>{filteredRecords.length}</strong> {filteredRecords.length === 1 ? 'record' : 'records'} in view</span>
        <span className="records-meta-note">{isGuest ? isAnonymousGuest ? 'Guest scope · synced submissions' : 'Guest scope · this browser only' : role === 'agent' ? 'Agent scope · all customers' : 'Customer scope · private to you'}</span>
      </div>

      <section className="surface-panel table-panel" aria-label="Insurance records">
        <div className="records-table-head">
          <div className="table-cell-check">
            <input
              aria-label="Select all records in view"
              checked={isAllSelected}
              className="table-checkbox"
              onChange={handleSelectAll}
              ref={(el) => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              type="checkbox"
            />
          </div>
          <button
            className={`table-head-btn ${sortField === 'applicant' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('applicant')}
            title="Sort by Applicant"
            type="button"
          >
            <span>Applicant</span>
            {renderSortIcon('applicant')}
          </button>
          <button
            className={`table-head-btn ${sortField === 'premium' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('premium')}
            title="Sort by Plan & Premium"
            type="button"
          >
            <span>Plan & premium</span>
            {renderSortIcon('premium')}
          </button>
          <button
            className={`table-head-btn ${sortField === 'doc' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('doc')}
            title="Sort by Date of Commencement"
            type="button"
          >
            <span>Date of Commencement</span>
            {renderSortIcon('doc')}
          </button>
          <button
            className={`table-head-btn ${sortField === 'submittedAt' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('submittedAt')}
            title="Sort by Submitted date"
            type="button"
          >
            <span>Submitted</span>
            {renderSortIcon('submittedAt')}
          </button>
          <button
            className={`table-head-btn ${sortField === 'updatedAt' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('updatedAt')}
            title="Sort by Date Updated"
            type="button"
          >
            <span>Updated</span>
            {renderSortIcon('updatedAt')}
          </button>
          <button
            className={`table-head-btn ${sortField === 'status' ? 'is-sorted' : ''}`}
            onClick={() => handleSortToggle('status')}
            title="Sort by Status"
            type="button"
          >
            <span>Status</span>
            {renderSortIcon('status')}
          </button>
          <span className="visually-hidden">Actions</span>
        </div>
        {paginatedRecords.map((record) => {
          const docDate = record.formData?.commencementDate || record.formData?.doc || record.commencementDate;
          const hasSubmittedDate = getDateTimestamp(record.submittedAt) !== null;
          const isChecked = selectedIds.has(record.id);
          return (
            <div className={`record-row ${isChecked ? 'is-row-selected' : ''}`} key={record.id}>
              <div className="table-cell-check">
                <input
                  aria-label={`Select ${record.applicantName || 'record'}`}
                  checked={isChecked}
                  className="table-checkbox"
                  onChange={(e) => handleToggleRow(record.id, e)}
                  type="checkbox"
                />
              </div>
              <button className="record-person" onClick={() => onOpen(record)} type="button">
                <span className="person-mark">{(record.applicantName || '?').slice(0, 1).toUpperCase()}</span>
                <span className="record-person-info">
                  <strong>{record.applicantName || 'Unnamed applicant'}</strong>
                  <small className="record-case-number">{record.caseNumber || record.id}</small>
                  <small className="record-submitted-by">
                    {role === 'agent'
                      ? `Submitted by ${record.submittedByName || record.agentName || user.name || 'User'}`
                      : 'Your case'}
                  </small>
                </span>
              </button>
              <div className="record-plan">
                <strong>{record.planName || 'Plan not selected'}</strong>
                <small>
                  {formatMoney(record.premium)}
                  {record.formData?.premiumMode ? ` / ${record.formData.premiumMode}` : ''}
                  {' · '}
                  {formatMoney(record.sumAssured)} cover
                </small>
              </div>
              <div className="record-doc">
                {docDate ? (
                  <span>{formatDate(docDate)}</span>
                ) : (
                  <span className="record-doc-empty">Not specified</span>
                )}
              </div>
              <div className="record-date record-submitted-date">
                <span className="record-mobile-label">Submitted</span>
                {hasSubmittedDate ? formatDate(record.submittedAt) : <span className="record-date-empty">Not recorded</span>}
              </div>
              <span className="record-date">{formatDate(record.updatedAt)}</span>
              <StatusBadge status={record.status} />
              <div className="row-actions">
                <button aria-label={`Edit ${record.applicantName || 'record'}`} className="icon-button" onClick={() => onEdit(record)} title="Edit record" type="button"><Icon name="edit" size={16} /></button>
                <button aria-label={`Delete ${record.applicantName || 'record'}`} className="icon-button icon-danger" onClick={() => onDelete(record)} title="Delete record" type="button"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          );
        })}
        {!filteredRecords.length && (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="search" size={20} /></span>
            <h2>No records match that line.</h2>
            <p>Try another name or clear the filters to see everything in scope.</p>
            <button className="button button-secondary button-small" onClick={() => { setSearch(''); setStatusFilter('all'); }} type="button">Clear filters</button>
          </div>
        )}
      </section>
      {filteredRecords.length > 0 && (
        <nav className="records-pagination" aria-label="Records pagination">
          <div className="records-pagination-summary">
            Showing <strong>{firstRecordIndex + 1}-{lastRecordIndex}</strong> of <strong>{filteredRecords.length}</strong>
          </div>
          <div className="records-pagination-controls">
            <label className="records-page-size">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <button
              aria-label="Previous page"
              className="button button-quiet button-small pagination-button"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <Icon name="back" size={14} />
              <span>Previous</span>
            </button>
            <span aria-live="polite" className="records-page-status">
              Page <strong>{currentPage}</strong> of <strong>{pageCount}</strong>
            </span>
            <button
              aria-label="Next page"
              className="button button-quiet button-small pagination-button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              type="button"
            >
              <span>Next</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function FormView({
  role,
  user,
  form,
  activeStep,
  highestStep,
  fieldErrors,
  editingId,
  isSaving,
  onChange,
  onRepeaterChange,
  onAddRepeater,
  onRemoveRepeater,
  onStepChange,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
  isGuest,
  isAnonymousGuest,
}) {
  const step = STEPS[activeStep];
  const isLastStep = activeStep === STEPS.length - 1;

  return (
    <div className="page-view form-view">
      <header className="form-topbar">
        <button className="back-link" onClick={onBack} type="button"><Icon name="back" size={16} /> Back to {role === 'agent' ? 'databook' : 'submissions'}</button>
        <div className="form-topbar-meta">
          <span>{editingId ? `Editing ${editingId}` : 'New case score'}</span>
          <span className="topbar-divider" aria-hidden="true" />
          <span>{user.roleLabel} view</span>
        </div>
      </header>

      <div className="form-layout">
        <StepRail activeStep={activeStep} highestStep={highestStep} onStepChange={onStepChange} />
        <main className="form-main">
          <div className="form-main-header">
            <div>
              <span className="form-kicker">Insurance data form</span>
              <h1>{step.label}</h1>
              <p>{step.id === 'review' ? 'Check the record once before it leaves your workspace.' : 'Add only what this section needs. You can return to any completed movement.'}</p>
            </div>
            <div className="form-save-state" aria-live="polite">
              <span className={`save-dot ${isSaving ? 'is-saving' : ''}`} />
              {isSaving ? 'Saving…' : 'Ready to save'}
            </div>
          </div>

          <div className="form-section-wrap">
            {activeStep === 0 && (
              <>
                <SectionHeading description="Start with the person this proposal is about." number="01" title="Applicant details" />
                <div className="field-grid">
                  <Field error={fieldErrors.fullName} label="Name of Life Assured" name="fullName" onChange={onChange} placeholder="e.g. RAPOLU PRASAD" required value={form.fullName} />
                  <Field label="Proposer Name" name="proposerName" onChange={onChange} placeholder="e.g. SELF or Proposer's name" value={form.proposerName} />
                  <Field error={fieldErrors.aadhaar} helper="12 digits, grouped as 0000 0000 0000" inputMode="numeric" label="Aadhaar Number" maxLength={14} name="aadhaar" onChange={onChange} pattern="\d{4} \d{4} \d{4}" placeholder="0000 0000 0000" required value={form.aadhaar} />
                  <Field error={fieldErrors.pan} helper="Format: ABCDE1234F" label="PAN Number" maxLength={10} name="pan" onChange={onChange} pattern="[A-Z]{5}[0-9]{4}[A-Z]" placeholder="ABCDE1234F" value={form.pan} />
                  <Field label="CKYC" name="ckyc" onChange={onChange} placeholder="14-digit CKYC" value={form.ckyc} />
                  <Field label="ABHA" name="abha" onChange={onChange} placeholder="ABHA number" value={form.abha} />
                  <Field label="Father's Name" name="fatherName" onChange={onChange} placeholder="Father's full name" value={form.fatherName} />
                  <Field label="Mother's Name" name="motherName" onChange={onChange} placeholder="Mother's full name" value={form.motherName} />
                  <SelectField error={fieldErrors.gender} label="Gender" name="gender" onChange={onChange} options={['Male', 'Female', 'Trans', 'Non-binary', 'Prefer not to say']} required value={form.gender} />
                  <SelectField error={fieldErrors.maritalStatus} label="Is Married" name="maritalStatus" onChange={onChange} options={['Single', 'Married', 'Widowed', 'Divorced']} required value={form.maritalStatus} />
                  {(form.maritalStatus === 'Married' || form.maritalStatus === 'Yes') && (
                    <>
                      <Field error={fieldErrors.spouseName} label="Spouse's Name" name="spouseName" onChange={onChange} placeholder="Spouse's full name" required value={form.spouseName} />
                      <Field label="Date of Marriage" name="marriageDate" onChange={onChange} type="date" value={form.marriageDate} />
                    </>
                  )}
                </div>
              </>
            )}

            {activeStep === 1 && (
              <>
                <SectionHeading description="Reachability, date of birth, and regulatory address verification." number="02" title="Contact & Address" />
                <div className="field-grid">
                  <Field error={fieldErrors.mobileAadhaar} helper="10 digits, beginning with 6-9" inputMode="numeric" label="Mobile (Aadhaar linked)" maxLength={10} name="mobileAadhaar" onChange={onChange} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" required type="tel" value={form.mobileAadhaar} />
                  <Field error={fieldErrors.mobile} helper="10 digits, beginning with 6-9" inputMode="numeric" label="Alternate Mobile" maxLength={10} name="mobile" onChange={onChange} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile number" type="tel" value={form.mobile} />
                  <Field error={fieldErrors.whatsapp} helper="10 digits, beginning with 6-9" inputMode="numeric" label="WhatsApp Number" maxLength={10} name="whatsapp" onChange={onChange} pattern="[6-9][0-9]{9}" placeholder="10-digit WhatsApp number" type="tel" value={form.whatsapp} />
                  <Field error={fieldErrors.email} label="Email Address" name="email" onChange={onChange} placeholder="name@example.com" type="email" value={form.email} />
                  <Field error={fieldErrors.dateOfBirth} label="Date of Birth" name="dateOfBirth" onChange={onChange} required type="date" value={form.dateOfBirth} />
                  <Field helper="Calculated from DOB" label="Age (Near LB)" name="age" onChange={onChange} readOnly value={form.age} />
                  <Field label="Birth Place" name="birthPlace" onChange={onChange} placeholder="e.g. Cherlapally" value={form.birthPlace} />
                  <SelectField label="Residential Status" name="residentialStatus" onChange={onChange} options={['Resident Indian', 'NRI', 'FNIO']} value={form.residentialStatus} />
                </div>
                <div className="address-section" style={{ marginTop: '1.5rem' }}>
                  <CheckboxField checked={form.corrSameKyc} label="Is the correspondence address same as KYC?" name="corrSameKyc" onChange={onChange} />
                  <div className="field-grid" style={{ marginTop: '1rem' }}>
                    <TextAreaField label="Address as per KYC" name="address" onChange={onChange} placeholder="House no, Street, Locality, City, State, PIN" value={form.address} />
                    <TextAreaField disabled={form.corrSameKyc} helper={form.corrSameKyc ? 'Auto-synced from KYC address' : 'Mailing address if different'} label="Correspondence Address" name="corrAddress" onChange={onChange} placeholder="Correspondence address" readOnly={form.corrSameKyc} value={form.corrAddress} />
                  </div>
                  <div className="field-grid compact-grid" style={{ marginTop: '1rem' }}>
                    <Field label="City / Town" name="city" onChange={onChange} placeholder="e.g. Nalgonda" value={form.city} />
                    <SelectField label="State" name="state" onChange={onChange} options={STATE_OPTIONS} value={form.state} />
                    <Field label="PIN Code" name="pincode" onChange={onChange} placeholder="6-digit PIN" value={form.pincode} />
                  </div>
                </div>
              </>
            )}

            {activeStep === 2 && (
              <>
                <SectionHeading description="Educational qualification, professional profile, and annual earnings." number="03" title="Work & Income" />
                <div className="field-grid">
                  <Field label="Education" name="education" onChange={onChange} placeholder="e.g. Graduate, Intermediate, School" value={form.education} />
                  <Field error={fieldErrors.occupation} label="Current Job / Occupation" name="occupation" onChange={onChange} placeholder="e.g. Software Engineer, Weaver" required value={form.occupation} />
                  <Field label="Type of Duty" name="typeOfDuty" onChange={onChange} placeholder="e.g. Desk work, Weaver, Administration" value={form.typeOfDuty} />
                  <Field label="Company / Employer Name" name="employer" onChange={onChange} placeholder="Company or practice name" value={form.employer} />
                  <Field label="Since" name="since" onChange={onChange} placeholder="e.g. 5 Years or Year" value={form.since} />
                  <Field label="Total Experience" name="totalExperience" onChange={onChange} placeholder="e.g. 10 Years" value={form.totalExperience} />
                  <Field error={fieldErrors.annualIncome} label="Annual Income (₹)" name="annualIncome" onChange={onChange} placeholder="₹ 0" required type="number" value={form.annualIncome} />
                  <Field label="Last Year (LY) Income 1 (₹)" name="lyIncome1" onChange={onChange} placeholder="₹ 0" type="number" value={form.lyIncome1} />
                  <Field label="Last Year (LY) Income 2 (₹)" name="lyIncome2" onChange={onChange} placeholder="₹ 0" type="number" value={form.lyIncome2} />
                  <Field label="Last Year (LY) Income 3 (₹)" name="lyIncome3" onChange={onChange} placeholder="₹ 0" type="number" value={form.lyIncome3} />
                </div>
                {String(form.gender || '').toLowerCase() === 'female' && (
                  <div className="sub-panel" style={{ marginTop: '1.5rem' }}>
                    <div className="subsection-label">Husband Details</div>
                    <div className="field-grid">
                      <Field label="Husband Occupation" name="husbandOccupation" onChange={onChange} placeholder="Husband's occupation" value={form.husbandOccupation} />
                      <Field label="Husband Annual Income (₹)" name="husbandAnnualIncome" onChange={onChange} placeholder="₹ 0" type="number" value={form.husbandAnnualIncome} />
                    </div>
                  </div>
                )}
                <div className="inline-note"><Icon name="info" size={16} /><span>Use the income figure the customer is comfortable supporting with documentation.</span></div>
              </>
            )}

            {activeStep === 3 && (
              <>
                <SectionHeading description="Define the policy coverage, premium rhythm, and rider benefits." number="04" title="Proposed Plan" />
                <div className="field-grid">
                  <Field error={fieldErrors.planName} label="Plan" name="planName" onChange={onChange} placeholder="e.g. Jeevan Labh (936-25) or 751-15" required value={form.planName} />
                  <Field label="Policy No" name="planNumber" onChange={onChange} placeholder="Policy number if available" value={form.planNumber} />
                  <Field label="Policy Term (Years)" name="policyTerm" onChange={onChange} placeholder="Years" type="number" value={form.policyTerm} />
                  <Field label="PPT (Premium Paying Term)" name="ppt" onChange={onChange} placeholder="Years" type="number" value={form.ppt} />
                  <SelectField error={fieldErrors.premiumMode} label="Premium Mode" name="premiumMode" onChange={onChange} options={['Yearly', 'Half-Yearly', 'Quarterly', 'NACH', 'Monthly', 'Single']} required value={form.premiumMode} />
                  <Field error={fieldErrors.sumAssured} label="Sum Assured (₹)" name="sumAssured" onChange={onChange} placeholder="₹ 0" required type="number" value={form.sumAssured} />
                  <Field error={fieldErrors.premium} label="Premium (₹)" name="premium" onChange={onChange} placeholder="₹ 0" required type="number" value={form.premium} />
                  <SelectField label="Accidental Benefit" name="accidentalBenefit" onChange={onChange} options={['None', 'AB', 'ADDB']} value={form.accidentalBenefit} />
                  <SelectField label="Term Rider" name="termRider" onChange={onChange} options={['No', 'Yes']} value={form.termRider} />
                  <SelectField label="PWB (Premium Waiver Benefit)" name="pwb" onChange={onChange} options={['No', 'Yes']} value={form.pwb} />
                  <SelectField label="Dating Back" name="datingBack" onChange={onChange} options={['No', 'Yes']} value={form.datingBack} />
                  {form.datingBack === 'Yes' && (
                    <Field error={fieldErrors.datingBackDate} label="Dating Back Date" name="datingBackDate" onChange={onChange} required type="date" value={form.datingBackDate} />
                  )}
                  <Field label="Date of Commencement (DOC)" name="commencementDate" onChange={onChange} type="date" value={form.commencementDate} />
                </div>
                <div className="sub-panel" style={{ marginTop: '1.5rem' }}>
                  <div className="subsection-label">BOC Details (Optional)</div>
                  <div className="field-grid">
                    <Field label="BOC Number" name="bocNumber" onChange={onChange} placeholder="BOC receipt / number" value={form.bocNumber} />
                    <Field label="BOC Date" name="bocDate" onChange={onChange} type="date" value={form.bocDate} />
                    <Field label="BOC Amount (₹)" name="bocAmount" onChange={onChange} placeholder="₹ 0" type="number" value={form.bocAmount} />
                  </div>
                </div>
                <div className="plan-callout">
                  <span className="callout-rule" aria-hidden="true" />
                  <div><strong>Proposal rhythm</strong><p>{form.premium ? `${formatMoney(form.premium)} ${form.premiumMode.toLowerCase()} premium · Sum Assured: ${formatMoney(form.sumAssured)}` : 'Add the premium to see the case rhythm.'}</p></div>
                </div>
              </>
            )}

            {activeStep === 4 && (
              <>
                <SectionHeading description="Set the people who should receive the policy benefit, and appointee for minors." number="05" title="Nominee & Appointee" />
                {fieldErrors.nominees && <div className="validation-summary" role="alert"><Icon name="info" size={16} />{fieldErrors.nominees}</div>}
                <div className="repeater-stack">
                  {form.nominees.map((nominee, index) => (
                    <div className="repeater-row nominee-row" key={`nominee-${index}`}>
                      <div className="repeater-heading">
                        <span className="repeater-index">0{index + 1}</span>
                        <div><strong>Nominee {index + 1}</strong><small>Benefit allocation</small></div>
                        {form.nominees.length > 1 && (
                          <button className="remove-link" onClick={() => onRemoveRepeater('nominees', index)} type="button">
                            <Icon name="trash" size={15} /> Remove
                          </button>
                        )}
                      </div>
                      <div className="field-grid compact-grid">
                        <Field error={fieldErrors[`nominee-${index}-name`]} label="Full Name" name={`nominees.${index}.name`} onChange={(_, value) => onRepeaterChange('nominees', index, 'name', value)} placeholder="Nominee name" required value={nominee.name} />
                        <SelectField error={fieldErrors[`nominee-${index}-relation`]} label="Relation" name={`nominees.${index}.relation`} onChange={(_, value) => onRepeaterChange('nominees', index, 'relation', value)} options={['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other']} required value={nominee.relation} />
                        <Field label="Share %" name={`nominees.${index}.share`} onChange={(_, value) => onRepeaterChange('nominees', index, 'share', value)} placeholder="100" type="number" value={nominee.share} />
                        <Field label="Date of Birth" name={`nominees.${index}.dob`} onChange={(_, value) => onRepeaterChange('nominees', index, 'dob', value)} type="date" value={nominee.dob} />
                        <Field helper="Calculated from DOB" label="Age" name={`nominees.${index}.age`} onChange={(_, value) => onRepeaterChange('nominees', index, 'age', value)} placeholder="Years, months, days" readOnly value={nominee.age} />
                        <Field error={fieldErrors[`nominee-${index}-aadhaar`]} helper="12 digits, grouped as 0000 0000 0000" inputMode="numeric" label="Nominee Aadhaar" maxLength={14} name={`nominees.${index}.aadhaar`} onChange={(_, value) => onRepeaterChange('nominees', index, 'aadhaar', value)} pattern="\d{4} \d{4} \d{4}" placeholder="12-digit Aadhaar" value={nominee.aadhaar} />
                        <Field error={fieldErrors[`nominee-${index}-phone`]} helper="10 digits, beginning with 6-9" inputMode="numeric" label="Mobile Number" maxLength={10} name={`nominees.${index}.phone`} onChange={(_, value) => onRepeaterChange('nominees', index, 'phone', value)} pattern="[6-9][0-9]{9}" placeholder="10-digit mobile" type="tel" value={nominee.phone} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="repeater-footer">
                  <button className="button button-quiet" onClick={() => onAddRepeater('nominees')} type="button"><Icon name="plus" size={16} /> Add another nominee</button>
                  <span className={Math.round(form.nominees.reduce((sum, item) => sum + Number(item.share || 0), 0)) === 100 ? 'share-total is-valid' : 'share-total'}>
                    <span>Allocated</span>
                    <strong>{form.nominees.reduce((sum, item) => sum + Number(item.share || 0), 0)}%</strong>
                  </span>
                </div>

                <div className="sub-panel" style={{ marginTop: '2rem' }}>
                  <div className="subsection-label">Appointee Details (for minor nominee)</div>
                  <div className="field-grid">
                    <Field label="Appointee Name" name="appointeeName" onChange={onChange} placeholder="Full name of appointee" value={form.appointeeName} />
                    <Field label="Appointee Relation" name="appointeeRelation" onChange={onChange} placeholder="e.g. Uncle, Grandparent" value={form.appointeeRelation} />
                    <Field label="Appointee Age" name="appointeeAge" onChange={onChange} placeholder="Years" type="number" value={form.appointeeAge} />
                  </div>
                </div>
              </>
            )}

            {activeStep === 5 && (
              <>
                <SectionHeading description="Direct benefit payout and NEFT bank account information." number="06" title="Bank Details" />
                <div className="field-grid">
                  <Field label="Bank Name" name="bankName" onChange={onChange} placeholder="e.g. HDFC Bank, SBI" value={form.bankName} />
                  <SelectField label="Account Type" name="accountType" onChange={onChange} options={['Savings', 'Current', 'Salary']} value={form.accountType} />
                  <Field label="A/C Holder's Name" name="accountHolderName" onChange={onChange} placeholder="Name as in passbook / cheque" value={form.accountHolderName} />
                  <Field label="Account Number" name="accountNumber" onChange={onChange} placeholder="Account number" value={form.accountNumber} />
                  <Field error={fieldErrors.ifsc} helper="11 characters (e.g. HDFC0001234)" label="IFSC Code" maxLength={11} name="ifsc" onChange={onChange} pattern="[A-Z]{4}0[A-Z0-9]{6}" placeholder="HDFC0000000" value={form.ifsc} />
                  <Field error={fieldErrors.micr} helper="Exactly 9 digits" inputMode="numeric" label="MICR Code" maxLength={9} name="micr" onChange={onChange} pattern="\d{9}" placeholder="9-digit MICR" value={form.micr} />
                  <TextAreaField label="Bank Branch Address" name="bankAddress" onChange={onChange} placeholder="Branch name, street, city" value={form.bankAddress} />
                </div>
                <div className="inline-note"><Icon name="shield" size={16} /><span>Bank fields are treated as sensitive and protected by security rules.</span></div>
              </>
            )}

            {activeStep === 6 && (
              <>
                <SectionHeading description="Family health history, immediate relatives, and medical declarations." number="07" title="Family & Health" />
                <div className="subsection-label">Immediate Family</div>
                <div className="family-grid">
                  <div className="family-person">
                    <strong>Father</strong>
                    <div className="field-grid compact-grid">
                      <Field label="Age" name="fatherAge" onChange={onChange} type="number" value={form.fatherAge} />
                      <SelectField label="State of Health" name="fatherHealth" onChange={onChange} options={['Good', 'Dead']} value={form.fatherHealth} />
                    </div>
                    {form.fatherHealth === 'Dead' && (
                      <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                        <Field error={fieldErrors.fatherDiedAge} label="Age at Death" name="fatherDiedAge" onChange={onChange} placeholder="Years" type="number" value={form.fatherDiedAge} />
                        <Field error={fieldErrors.fatherDiedYear} label="Death Year" name="fatherDiedYear" onChange={onChange} placeholder="e.g. 2012" type="number" value={form.fatherDiedYear} />
                        <Field error={fieldErrors.fatherDiedCause} label="Cause of Death" name="fatherDiedCause" onChange={onChange} placeholder="Cause" value={form.fatherDiedCause} />
                      </div>
                    )}
                  </div>

                  <div className="family-person">
                    <strong>Mother</strong>
                    <div className="field-grid compact-grid">
                      <Field label="Age" name="motherAge" onChange={onChange} type="number" value={form.motherAge} />
                      <SelectField label="State of Health" name="motherHealth" onChange={onChange} options={['Good', 'Dead']} value={form.motherHealth} />
                    </div>
                    {form.motherHealth === 'Dead' && (
                      <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                        <Field error={fieldErrors.motherDiedAge} label="Age at Death" name="motherDiedAge" onChange={onChange} placeholder="Years" type="number" value={form.motherDiedAge} />
                        <Field error={fieldErrors.motherDiedYear} label="Death Year" name="motherDiedYear" onChange={onChange} placeholder="e.g. 2018" type="number" value={form.motherDiedYear} />
                        <Field error={fieldErrors.motherDiedCause} label="Cause of Death" name="motherDiedCause" onChange={onChange} placeholder="Cause" value={form.motherDiedCause} />
                      </div>
                    )}
                  </div>

                  {(form.maritalStatus === 'Married' || form.maritalStatus === 'Yes') && (
                    <div className="family-person">
                      <strong>Spouse</strong>
                      <div className="field-grid compact-grid">
                        <Field label="Age" name="spouseAge" onChange={onChange} type="number" value={form.spouseAge} />
                        <SelectField label="State of Health" name="spouseHealth" onChange={onChange} options={['Good', 'Dead']} value={form.spouseHealth} />
                      </div>
                      {form.spouseHealth === 'Dead' && (
                        <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                          <Field error={fieldErrors.spouseDiedAge} label="Age at Death" name="spouseDiedAge" onChange={onChange} placeholder="Years" type="number" value={form.spouseDiedAge} />
                          <Field error={fieldErrors.spouseDiedYear} label="Death Year" name="spouseDiedYear" onChange={onChange} placeholder="e.g. 2020" type="number" value={form.spouseDiedYear} />
                          <Field error={fieldErrors.spouseDiedCause} label="Cause of Death" name="spouseDiedCause" onChange={onChange} placeholder="Cause" value={form.spouseDiedCause} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="subsection-label" style={{ marginTop: '1.5rem' }}>Siblings</div>
                <div className="mini-repeater">
                  {form.siblings.map((sibling, index) => (
                    <div className="mini-repeater-card" key={`sibling-${index}`}>
                      <div className="mini-repeater-row">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <SelectField label="Relation" name={`siblings.${index}.relation`} onChange={(_, value) => onRepeaterChange('siblings', index, 'relation', value)} options={['Brother', 'Sister']} value={sibling.relation} />
                        <Field label="Age" name={`siblings.${index}.age`} onChange={(_, value) => onRepeaterChange('siblings', index, 'age', value)} type="number" value={sibling.age} />
                        <SelectField label="State" name={`siblings.${index}.health`} onChange={(_, value) => onRepeaterChange('siblings', index, 'health', value)} options={['Good', 'Dead']} value={sibling.health} />
                        <button aria-label="Remove sibling" className="icon-button icon-danger" onClick={() => onRemoveRepeater('siblings', index)} type="button"><Icon name="trash" size={15} /></button>
                      </div>
                      {sibling.health === 'Dead' && (
                        <div className="field-grid compact-grid death-subgrid">
                          <Field label="Age at Death" name={`siblings.${index}.diedAge`} onChange={(_, value) => onRepeaterChange('siblings', index, 'diedAge', value)} type="number" value={sibling.diedAge} />
                          <Field label="Death Year" name={`siblings.${index}.diedYear`} onChange={(_, value) => onRepeaterChange('siblings', index, 'diedYear', value)} type="number" value={sibling.diedYear} />
                          <Field label="Cause of Death" name={`siblings.${index}.diedCause`} onChange={(_, value) => onRepeaterChange('siblings', index, 'diedCause', value)} value={sibling.diedCause} />
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="button button-quiet button-small" onClick={() => onAddRepeater('siblings')} type="button"><Icon name="plus" size={15} /> Add sibling</button>
                </div>

                <div className="subsection-label" style={{ marginTop: '1.5rem' }}>Children</div>
                <div className="mini-repeater">
                  {form.children.map((child, index) => (
                    <div className="mini-repeater-card" key={`child-${index}`}>
                      <div className="mini-repeater-row">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <Field label="Age" name={`children.${index}.age`} onChange={(_, value) => onRepeaterChange('children', index, 'age', value)} type="number" value={child.age} />
                        <SelectField label="State" name={`children.${index}.health`} onChange={(_, value) => onRepeaterChange('children', index, 'health', value)} options={['Good', 'Dead']} value={child.health} />
                        <button aria-label="Remove child" className="icon-button icon-danger" onClick={() => onRemoveRepeater('children', index)} type="button"><Icon name="trash" size={15} /></button>
                      </div>
                      {child.health === 'Dead' && (
                        <div className="field-grid compact-grid death-subgrid">
                          <Field label="Age at Death" name={`children.${index}.diedAge`} onChange={(_, value) => onRepeaterChange('children', index, 'diedAge', value)} type="number" value={child.diedAge} />
                          <Field label="Death Year" name={`children.${index}.diedYear`} onChange={(_, value) => onRepeaterChange('children', index, 'diedYear', value)} type="number" value={child.diedYear} />
                          <Field label="Cause of Death" name={`children.${index}.diedCause`} onChange={(_, value) => onRepeaterChange('children', index, 'diedCause', value)} value={child.diedCause} />
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="button button-quiet button-small" onClick={() => onAddRepeater('children')} type="button"><Icon name="plus" size={15} /> Add child</button>
                </div>

                <div className="subsection-label" style={{ marginTop: '1.5rem' }}>Medical Measurements & Declarations</div>
                <div className="field-grid compact-grid health-measurements">
                  <Field label="Height (cm)" name="height" onChange={onChange} placeholder="e.g. 165" type="number" value={form.height} />
                  <Field label="Weight (kg)" name="weight" onChange={onChange} placeholder="e.g. 68" type="number" value={form.weight} />
                  <Field label="Abdomen (cm)" name="abdomen" onChange={onChange} placeholder="e.g. 80" type="number" value={form.abdomen} />
                </div>
                <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                  <SelectField label="Any Past Operations?" name="operations" onChange={onChange} options={['No', 'Yes']} value={form.operations} />
                  {form.operations === 'Yes' && (
                    <Field error={fieldErrors.operationsDetails} label="Operation Details" name="operationsDetails" onChange={onChange} placeholder="Details of surgery or operation" value={form.operationsDetails} />
                  )}
                </div>
                <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                  <SelectField label="Any Diseases?" name="disease" onChange={onChange} options={['No', 'Yes']} value={form.disease} />
                  {form.disease === 'Yes' && (
                    <Field error={fieldErrors.diseaseDetails} label="Disease Details" name="diseaseDetails" onChange={onChange} placeholder="Details of diseases or medical conditions" value={form.diseaseDetails} />
                  )}
                </div>

                {String(form.gender || '').toLowerCase() === 'female' && (
                  <div className="field-grid compact-grid" style={{ marginTop: '0.75rem' }}>
                    <SelectField label="Are you pregnant?" name="pregnancy" onChange={onChange} options={['No', 'Yes']} value={form.pregnancy} />
                    <Field label="Date of Last Delivery" name="lastDelivery" onChange={onChange} type="date" value={form.lastDelivery} />
                  </div>
                )}
              </>
            )}

            {activeStep === 7 && (
              <>
                <SectionHeading description="Record past life insurance policies to ensure full regulatory disclosure." number="08" title="Previous Policies" />
                <div className="repeater-stack">
                  {form.previousPolicies.map((policy, index) => (
                    <div className="repeater-row previous-row" key={`policy-${index}`}>
                      <div className="repeater-heading">
                        <span className="repeater-index">0{index + 1}</span>
                        <div><strong>Previous Policy {index + 1}</strong><small>Policy history</small></div>
                        <button className="remove-link" onClick={() => onRemoveRepeater('previousPolicies', index)} type="button">
                          <Icon name="trash" size={15} /> Remove
                        </button>
                      </div>
                      <div className="field-grid compact-grid">
                        <Field label="Policy Number" name={`previousPolicies.${index}.policyNumber`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'policyNumber', value)} placeholder="e.g. 685412998" value={policy.policyNumber} />
                        <Field label="Branch" name={`previousPolicies.${index}.branch`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'branch', value)} placeholder="Branch name" value={policy.branch} />
                        <Field label="Plan / Term" name={`previousPolicies.${index}.planTerm`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'planTerm', value)} placeholder="e.g. 814-20" value={policy.planTerm} />
                        <Field label="Sum Assured (₹)" name={`previousPolicies.${index}.sumAssured`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'sumAssured', value)} placeholder="₹ 0" type="number" value={policy.sumAssured} />
                        <Field label="Premium (₹)" name={`previousPolicies.${index}.premium`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'premium', value)} placeholder="₹ 0" type="number" value={policy.premium} />
                        <SelectField label="Mode" name={`previousPolicies.${index}.mode`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'mode', value)} options={['Yearly', 'Half Yearly', 'Quarterly', 'NACH', 'Single']} value={policy.mode} />
                        <SelectField label="Accidental Benefit" name={`previousPolicies.${index}.accidentalBenefit`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'accidentalBenefit', value)} options={['None', 'AB', 'ADDB']} value={policy.accidentalBenefit} />
                        <Field label="Date of Commencement" name={`previousPolicies.${index}.commencementDate`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'commencementDate', value)} type="date" value={policy.commencementDate} />
                        <SelectField label="Rate Accepted" name={`previousPolicies.${index}.rateAccepted`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'rateAccepted', value)} options={['Ordinary Rate', 'Special Rate']} value={policy.rateAccepted} />
                        <SelectField label="Medical" name={`previousPolicies.${index}.medicalType`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'medicalType', value)} options={['Medical', 'Non-Medical']} value={policy.medicalType} />
                        <SelectField label="Inforce Status" name={`previousPolicies.${index}.inforce`} onChange={(_, value) => onRepeaterChange('previousPolicies', index, 'inforce', value)} options={['Yes', 'No', 'In force', 'Lapsed', 'Matured', 'Surrendered']} value={policy.inforce} />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="button button-quiet" onClick={() => onAddRepeater('previousPolicies')} type="button">
                  <Icon name="plus" size={16} /> Add previous policy
                </button>
                {!form.previousPolicies.length && (
                  <div className="empty-inline"><Icon name="check" size={15} /><span>No previous policies recorded. You can continue.</span></div>
                )}
              </>
            )}

            {activeStep === 8 && (
              <ReviewPanel fieldErrors={fieldErrors} form={form} isAnonymousGuest={isAnonymousGuest} isGuest={isGuest} onStepChange={onStepChange} />
            )}
          </div>

          <footer className="form-footer">
            <button className="button button-quiet" disabled={activeStep === 0} onClick={() => onStepChange(activeStep - 1)} type="button"><Icon name="back" size={16} /> Previous</button>
            <div className="form-footer-actions">
              <button className="button button-secondary" disabled={isSaving} onClick={onSaveDraft} type="button">{isSaving ? 'Saving…' : 'Save draft'}</button>
              {isLastStep ? (
                <button className="button button-primary" disabled={isSaving} onClick={onSubmit} type="button"><Icon name="check" size={16} /> Submit record</button>
              ) : (
                <button className="button button-primary" onClick={onNext} type="button">Continue <Icon name="arrow" size={16} /></button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ReviewPanel({ form, fieldErrors, isAnonymousGuest, isGuest, onStepChange }) {
  const reviewSections = [
    {
      step: 0,
      title: 'Applicant & Identity',
      fields: [
        ['fullName', 'Full name'],
        ['proposerName', 'Proposer name'],
        ['fatherName', 'Father\'s name'],
        ['motherName', 'Mother\'s name'],
        ['dateOfBirth', 'Date of birth'],
        ['birthPlace', 'Place of birth'],
        ['age', 'Age (Near LB)'],
        ['gender', 'Gender'],
        ['maritalStatus', 'Marital status'],
        ['spouseName', 'Spouse name'],
        ['marriageDate', 'Marriage date'],
        ['residentialStatus', 'Residential status'],
        ['aadhaar', 'Aadhaar card number'],
        ['pan', 'PAN card number'],
        ['ckyc', 'CKYC number'],
        ['abha', 'ABHA ID / card number'],
      ],
    },
    {
      step: 1,
      title: 'Contact & Addresses',
      fields: [
        ['mobile', 'Primary mobile'],
        ['mobileAadhaar', 'Aadhaar linked mobile'],
        ['whatsapp', 'WhatsApp number'],
        ['email', 'Email address'],
        ['address', 'KYC address'],
        ['corrAddress', 'Correspondence address'],
        ['city', 'City / Village'],
        ['state', 'State'],
        ['pincode', 'Pincode'],
      ],
    },
    {
      step: 2,
      title: 'Work & Income',
      fields: [
        ['education', 'Educational qualification'],
        ['occupation', 'Occupation'],
        ['typeOfDuty', 'Nature of duty'],
        ['employer', 'Employer / Business name'],
        ['since', 'Employed since'],
        ['totalExperience', 'Total experience'],
        ['annualIncome', 'Current annual income'],
        ['lyIncome1', 'Last year income (Year 1)'],
        ['lyIncome2', 'Last year income (Year 2)'],
        ['lyIncome3', 'Last year income (Year 3)'],
        ['husbandOccupation', 'Husband occupation'],
        ['husbandAnnualIncome', 'Husband annual income'],
      ],
    },
    {
      step: 3,
      title: 'Proposed Plan',
      fields: [
        ['planName', 'Plan / Table'],
        ['planNumber', 'Policy / Plan code'],
        ['policyTerm', 'Policy term (Years)'],
        ['ppt', 'Premium paying term (PPT)'],
        ['sumAssured', 'Sum assured'],
        ['premium', 'Approx. premium'],
        ['premiumMode', 'Premium mode'],
        ['accidentalBenefit', 'Accidental benefit'],
        ['termRider', 'Term rider'],
        ['pwb', 'Premium waiver benefit (PWB)'],
        ['datingBack', 'Dating back chosen'],
        ['datingBackDate', 'Dating back date'],
        ['bocNumber', 'BOC number'],
        ['bocDate', 'BOC date'],
        ['bocAmount', 'BOC amount'],
        ['commencementDate', 'Date of commencement (DOC)'],
      ],
    },
    {
      step: 4,
      title: 'Nominees & Appointee',
      fields: [
        ['nominees', 'Nominees'],
        ['appointeeName', 'Appointee name'],
        ['appointeeRelation', 'Appointee relationship'],
        ['appointeeAge', 'Appointee age'],
      ],
    },
    {
      step: 5,
      title: 'Bank Details',
      fields: [
        ['bankName', 'Bank name'],
        ['accountType', 'Account type'],
        ['accountHolderName', 'Account holder name'],
        ['accountNumber', 'Account number'],
        ['ifsc', 'IFSC code'],
        ['micr', 'MICR code'],
        ['bankAddress', 'Bank branch address'],
      ],
    },
    {
      step: 6,
      title: 'Family & Personal Health',
      fields: [
        ['familySummary', 'Family history'],
        ['height', 'Height (cm)'],
        ['weight', 'Weight (kg)'],
        ['abdomen', 'Abdomen girth (cm)'],
        ['operations', 'Past operations'],
        ['operationsDetails', 'Operation details'],
        ['disease', 'Past illness / diseases'],
        ['diseaseDetails', 'Disease details'],
        ['pregnancy', 'Currently pregnant'],
        ['lastDelivery', 'Last delivery date'],
      ],
    },
    {
      step: 7,
      title: 'Previous Policies',
      fields: [
        ['previousPoliciesSummary', 'Previous life insurance policies'],
      ],
    },
  ];

  return (
    <div className="review-panel">
      <SectionHeading description="A final pass keeps the submitted record useful to everyone who touches it." number="09" title="Review & submit" />
      {Object.keys(fieldErrors).length > 0 && (
        <div className="validation-summary" role="alert">
          <Icon name="info" size={16} />
          <span>There are a few details to resolve. Use the edit links below to return to their section.</span>
        </div>
      )}
      <div className="review-grid">
        {reviewSections.map((section) => (
          <section className="review-block" key={section.title}>
            <div className="review-block-heading">
              <h3>{section.title}</h3>
              <button className="text-button" onClick={() => onStepChange(section.step)} type="button">
                Edit <Icon name="edit" size={14} />
              </button>
            </div>
            <dl>
              {section.fields.map(([field, label]) => {
                let displayValue = form[field];

                if (field === 'nominees') {
                  displayValue = form.nominees && form.nominees.length
                    ? form.nominees.map((nominee) => `${nominee.name || 'Unnamed'} (${nominee.relation || 'Relation'}, ${nominee.share || 0}%)`).join('; ')
                    : 'None added';
                } else if (field === 'familySummary') {
                  const parts = [];
                  if (form.fatherAge || form.fatherHealth) {
                    parts.push(`Father: ${form.fatherHealth || 'Good'} (Age: ${form.fatherAge || 'N/A'}${form.fatherHealth === 'Dead' ? `, Died Age: ${form.fatherDiedAge || 'N/A'}, Year: ${form.fatherDiedYear || 'N/A'}, Cause: ${form.fatherDiedCause || 'N/A'}` : ''})`);
                  }
                  if (form.motherAge || form.motherHealth) {
                    parts.push(`Mother: ${form.motherHealth || 'Good'} (Age: ${form.motherAge || 'N/A'}${form.motherHealth === 'Dead' ? `, Died Age: ${form.motherDiedAge || 'N/A'}, Year: ${form.motherDiedYear || 'N/A'}, Cause: ${form.motherDiedCause || 'N/A'}` : ''})`);
                  }
                  if (form.spouseAge || form.spouseHealth) {
                    parts.push(`Spouse: ${form.spouseHealth || 'Good'} (Age: ${form.spouseAge || 'N/A'}${form.spouseHealth === 'Dead' ? `, Died Age: ${form.spouseDiedAge || 'N/A'}, Year: ${form.spouseDiedYear || 'N/A'}, Cause: ${form.spouseDiedCause || 'N/A'}` : ''})`);
                  }
                  if (form.siblings?.length) parts.push(`${form.siblings.length} sibling(s)`);
                  if (form.children?.length) parts.push(`${form.children.length} child(ren)`);
                  displayValue = parts.length ? parts.join(' | ') : 'Not added';
                } else if (field === 'previousPoliciesSummary') {
                  displayValue = form.previousPolicies && form.previousPolicies.length
                    ? form.previousPolicies.map((p, i) => `#${i + 1}: ${p.policyNumber || 'No #'} (${p.planTerm || 'Plan'}, ₹${p.sumAssured || 0})`).join('; ')
                    : 'None recorded';
                } else if (field === 'premium' || field === 'sumAssured' || field === 'annualIncome' || field === 'lyIncome1' || field === 'lyIncome2' || field === 'lyIncome3' || field === 'husbandAnnualIncome' || field === 'bocAmount') {
                  displayValue = displayValue ? formatMoney(displayValue) : displayValue === 0 ? '₹ 0' : 'Not added';
                }

                return (
                  <div className={fieldErrors[field] ? 'review-field has-error' : 'review-field'} key={field}>
                    <dt>{label}</dt>
                    <dd>{displayValue || 'Not added'}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
      <div className="review-ready">
        <span className="ready-mark"><Icon name={isGuest ? 'info' : 'shield'} size={18} /></span>
        <div>
          <strong>Ready for a careful submit?</strong>
          <p>
            {isGuest
              ? isAnonymousGuest
                ? 'This record will sync securely so your agent can review it. Your guest access remains tied to this browser.'
                : 'Submitting will create a temporary anonymous Firebase account and send this record securely to your agent.'
              : 'This record will be visible to the agent workspace and to the customer who owns it.'}
          </p>
        </div>
      </div>
    </div>
  );
}

const DRAWER_PLACEHOLDERS = new Set([
  '-',
  '—',
  'Date not set',
  'No date',
  'No #',
  'N/A',
  'Not added',
  'Not recorded',
  'Not selected',
  'Not specified',
  'None added',
  'None recorded',
  'Plan',
  'Plan not selected',
  'Proposed Plan',
  'Unknown user',
  'Guest',
  'Guest user',
  'Agent',
  'Unnamed customer',
  'Unnamed',
  'Unnamed applicant',
]);

function hasDrawerValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized !== '' && !DRAWER_PLACEHOLDERS.has(normalized);
  }
  return true;
}

function getDrawerDate(value) {
  return getDateTimestamp(value) === null ? null : formatDate(value);
}

function getDrawerMoney(value) {
  if (!hasDrawerValue(value) || Number(value) === 0) return null;
  return formatMoney(value);
}

function joinDrawerValues(values, separator = ' · ') {
  const presentValues = values.filter(hasDrawerValue);
  return presentValues.length ? presentValues.join(separator) : null;
}

function getDrawerHealthValue(health, age, diedAge, diedYear, diedCause) {
  const details = [];
  if (hasDrawerValue(health)) details.push(health);
  if (hasDrawerValue(age)) details.push(`Age: ${age}`);
  if (health === 'Dead') {
    if (hasDrawerValue(diedAge)) details.push(`Died age: ${diedAge}`);
    if (hasDrawerValue(diedYear)) details.push(`Died year: ${diedYear}`);
    if (hasDrawerValue(diedCause)) details.push(`Cause: ${diedCause}`);
  }
  return joinDrawerValues(details);
}

function drawerRow(label, value, key) {
  if (!hasDrawerValue(value)) return null;
  return (
    <div key={key}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DrawerSection({ label, rows }) {
  const visibleRows = rows.filter(Boolean);
  if (!visibleRows.length) return null;
  return (
    <div className="drawer-section">
      <span className="drawer-section-label">{label}</span>
      <dl>{visibleRows}</dl>
    </div>
  );
}

function RecordDrawer({ record, onClose, onEdit }) {
  if (!record) return null;
  const data = record.formData || {};
  const applicantName = data.fullName || record.applicantName;
  const updatedDate = getDrawerDate(record.updatedAt);
  const planName = data.planName || record.planName;
  const sumAssured = getDrawerMoney(record.sumAssured || data.sumAssured);
  const premium = getDrawerMoney(record.premium || data.premium);
  const totalMeta = [
    sumAssured && premium ? `${premium} ${data.premiumMode?.toLowerCase() || 'annual'} premium` : null,
    data.policyTerm ? `Term: ${data.policyTerm} yrs` : null,
    data.ppt ? `PPT: ${data.ppt} yrs` : null,
  ].filter(Boolean).join(' · ');
  const totalHeadline = sumAssured || premium;
  const totalLabel = sumAssured ? 'Sum assured' : 'Premium';
  const genderMarital = joinDrawerValues([data.gender, data.maritalStatus]);
  const marriageDate = getDrawerDate(data.marriageDate);
  const spouse = data.spouseName
    ? joinDrawerValues([data.spouseName, marriageDate ? `(m. ${marriageDate})` : null], ' ')
    : null;
  const location = joinDrawerValues([data.city, data.state, data.pincode], ', ');
  const lastThreeIncome = [data.lyIncome1, data.lyIncome2, data.lyIncome3]
    .map(getDrawerMoney)
    .filter(Boolean)
    .join(' · ');
  const termAndPpt = joinDrawerValues([
    data.policyTerm ? `Term: ${data.policyTerm} yrs` : null,
    data.ppt ? `PPT: ${data.ppt} yrs` : null,
  ]);
  const planSumAssured = getDrawerMoney(data.sumAssured);
  const planPremium = getDrawerMoney(data.premium);
  const planAmounts = joinDrawerValues([
    planSumAssured ? `Sum assured: ${planSumAssured}` : null,
    planPremium ? `${planPremium} ${data.premiumMode?.toLowerCase() || 'annual'} premium` : null,
  ]);
  const datingBackDate = getDrawerDate(data.datingBackDate);
  const datingBack = data.datingBack
    ? joinDrawerValues([data.datingBack, datingBackDate ? `Date: ${datingBackDate}` : null])
    : null;
  const bocDate = getDrawerDate(data.bocDate);
  const bocDetails = joinDrawerValues([
    data.bocNumber ? `#${data.bocNumber}` : null,
    bocDate,
    data.bocAmount ? getDrawerMoney(data.bocAmount) : null,
  ]);
  const nominees = (data.nominees || []).filter((nominee) => [
    nominee.name,
    nominee.relation,
    nominee.dob,
    nominee.age,
    nominee.aadhaar,
    nominee.phone,
  ].some(hasDrawerValue));
  const previousPolicies = (data.previousPolicies || []).filter((policy) => [
    policy.policyNumber,
    policy.branch,
    policy.planTerm,
    getDrawerMoney(policy.sumAssured),
    getDrawerMoney(policy.premium),
    policy.accidentalBenefit,
    getDrawerDate(policy.commencementDate),
  ].some(hasDrawerValue));
  const father = getDrawerHealthValue(data.fatherHealth, data.fatherAge, data.fatherDiedAge, data.fatherDiedYear, data.fatherDiedCause);
  const mother = getDrawerHealthValue(data.motherHealth, data.motherAge, data.motherDiedAge, data.motherDiedYear, data.motherDiedCause);
  const spouseHealth = getDrawerHealthValue(data.spouseHealth, data.spouseAge, data.spouseDiedAge, data.spouseDiedYear, data.spouseDiedCause);
  const bodyMetrics = joinDrawerValues([
    data.height ? `${data.height} cm` : null,
    data.weight ? `${data.weight} kg` : null,
    data.abdomen ? `${data.abdomen} cm` : null,
  ]);
  const ifscMicr = joinDrawerValues([data.ifsc, data.micr], ' / ');
  const drawerLabel = record.caseNumber || record.id;

  return (
    <div className="drawer-layer" role="presentation">
      <button aria-label="Close record details" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-labelledby="drawer-title" className="record-drawer" role="dialog">
        <div className="drawer-header">
          <div>
            {hasDrawerValue(drawerLabel) && <span className="drawer-label">{drawerLabel}</span>}
            <h2 id="drawer-title">{hasDrawerValue(applicantName) ? applicantName : 'Record details'}</h2>
          </div>
          <button aria-label="Close details" className="icon-button" onClick={onClose} type="button"><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-summary">
          {record.status && <StatusBadge status={record.status} />}
          {updatedDate && <span>{updatedDate}</span>}
          {hasDrawerValue(planName) && <span>{planName}</span>}
        </div>
        <div className="drawer-content">
          {totalHeadline && (
            <div className="drawer-total">
              <span>{totalLabel}</span>
              <strong>{totalHeadline}</strong>
              {totalMeta && <small>{totalMeta}</small>}
            </div>
          )}

          <DrawerSection
            label="Applicant & Identity"
            rows={[
              drawerRow('Full Name', data.fullName || record.applicantName, 'full-name'),
              drawerRow('Proposer Name', data.proposerName, 'proposer-name'),
              drawerRow("Father's Name", data.fatherName, 'father-name'),
              drawerRow("Mother's Name", data.motherName, 'mother-name'),
              drawerRow('Date of birth', getDrawerDate(data.dateOfBirth), 'date-of-birth'),
              drawerRow('Age (Near LB)', data.age, 'age'),
              drawerRow('Birth Place', data.birthPlace, 'birth-place'),
              drawerRow('Gender / Marital', genderMarital, 'gender-marital'),
              drawerRow('Spouse', spouse, 'spouse'),
              drawerRow('Residential Status', data.residentialStatus, 'residential-status'),
              drawerRow('Aadhaar Number', data.aadhaar, 'aadhaar'),
              drawerRow('PAN Number', data.pan, 'pan'),
              drawerRow('CKYC Number', data.ckyc, 'ckyc'),
              drawerRow('ABHA ID', data.abha, 'abha'),
            ]}
          />

          <DrawerSection
            label="Contact & Address"
            rows={[
              drawerRow('Primary Mobile', data.mobile, 'primary-mobile'),
              drawerRow('Aadhaar Mobile', data.mobileAadhaar, 'aadhaar-mobile'),
              drawerRow('WhatsApp', data.whatsapp, 'whatsapp'),
              drawerRow('Email', data.email, 'email'),
              drawerRow('KYC Address', data.address, 'kyc-address'),
              drawerRow('Correspondence Address', data.corrAddress || (data.corrSameKyc ? 'Same as KYC' : null), 'correspondence-address'),
              drawerRow('City / State / PIN', location, 'location'),
            ]}
          />

          <DrawerSection
            label="Work & Income"
            rows={[
              drawerRow('Education', data.education, 'education'),
              drawerRow('Occupation', data.occupation, 'occupation'),
              drawerRow('Nature of duty', data.typeOfDuty, 'nature-of-duty'),
              drawerRow('Employer', data.employer, 'employer'),
              drawerRow('Since', data.since, 'since'),
              drawerRow('Total Experience', data.totalExperience, 'total-experience'),
              drawerRow('Annual Income', getDrawerMoney(data.annualIncome), 'annual-income'),
              drawerRow('Last 3 Years', lastThreeIncome, 'last-three-years'),
              drawerRow('Husband Details', joinDrawerValues([data.husbandOccupation, getDrawerMoney(data.husbandAnnualIncome)]), 'husband-details'),
            ]}
          />

          <DrawerSection
            label="Proposed Plan"
            rows={[
              drawerRow('Plan', planName, 'plan'),
              drawerRow('Policy / Plan No', data.planNumber, 'plan-number'),
              drawerRow('Term / PPT', termAndPpt, 'term-ppt'),
              drawerRow('Sum Assured / Premium', planAmounts, 'plan-amounts'),
              drawerRow('Term Rider', data.termRider, 'term-rider'),
              drawerRow('Accidental Benefit', data.accidentalBenefit, 'accidental-benefit'),
              drawerRow('PWB', data.pwb, 'pwb'),
              drawerRow('Dating Back', datingBack, 'dating-back'),
              drawerRow('BOC Details', bocDetails, 'boc-details'),
              drawerRow('DOC', getDrawerDate(data.commencementDate), 'doc'),
            ]}
          />

          <DrawerSection
            label="Nominees & Appointee"
            rows={[
              ...nominees.map((nominee, index) => drawerRow(
                `Nominee ${index + 1}`,
                joinDrawerValues([
                  nominee.name,
                  nominee.relation,
                  nominee.share ? `${nominee.share}%` : null,
                  getDrawerDate(nominee.dob) ? `DOB: ${getDrawerDate(nominee.dob)}` : nominee.age ? `Age: ${nominee.age}` : null,
                  nominee.aadhaar ? `Aadhaar: ${nominee.aadhaar}` : null,
                  nominee.phone ? `Ph: ${nominee.phone}` : null,
                ]),
                `nominee-${index}`,
              )),
              drawerRow(
                'Appointee',
                joinDrawerValues([
                  data.appointeeName,
                  data.appointeeRelation ? `Relation: ${data.appointeeRelation}` : null,
                  data.appointeeAge ? `Age: ${data.appointeeAge}` : null,
                ]),
                'appointee',
              ),
            ]}
          />

          <DrawerSection
            label="Bank Details"
            rows={[
              drawerRow('Bank Name', data.bankName, 'bank-name'),
              drawerRow('Account Holder', data.accountHolderName, 'account-holder'),
              drawerRow('Account Number', data.accountNumber, 'account-number'),
              drawerRow('Account Type', data.accountType, 'account-type'),
              drawerRow('IFSC / MICR', ifscMicr, 'ifsc-micr'),
              drawerRow('Branch Address', data.bankAddress, 'bank-address'),
            ]}
          />

          <DrawerSection
            label="Family & Personal Health"
            rows={[
              drawerRow('Father', father, 'father'),
              drawerRow('Mother', mother, 'mother'),
              drawerRow('Spouse', spouseHealth, 'spouse-health'),
              data.siblings?.length > 0 && drawerRow(
                `Siblings (${data.siblings.length})`,
                data.siblings.map((s) => joinDrawerValues([
                  s.relation,
                  s.health,
                  s.age ? `${s.age} yrs` : null,
                  s.diedAge ? `Died age: ${s.diedAge}` : null,
                  s.diedYear ? `Died year: ${s.diedYear}` : null,
                  s.diedCause ? `Cause: ${s.diedCause}` : null,
                ])).filter(Boolean).join('; '),
                'siblings',
              ),
              data.children?.length > 0 && drawerRow(
                `Children (${data.children.length})`,
                data.children.map((child, index) => joinDrawerValues([
                  `Child ${index + 1}`,
                  child.health,
                  child.age ? `${child.age} yrs` : null,
                  child.diedAge ? `Died age: ${child.diedAge}` : null,
                  child.diedYear ? `Died year: ${child.diedYear}` : null,
                  child.diedCause ? `Cause: ${child.diedCause}` : null,
                ])).filter(Boolean).join('; '),
                'children',
              ),
              drawerRow('Height / Weight / Abdomen', bodyMetrics, 'body-metrics'),
              drawerRow('Operations', joinDrawerValues([data.operations, data.operationsDetails ? `Details: ${data.operationsDetails}` : null]), 'operations'),
              drawerRow('Diseases', joinDrawerValues([data.disease, data.diseaseDetails ? `Details: ${data.diseaseDetails}` : null]), 'diseases'),
              drawerRow('Pregnancy', joinDrawerValues([data.pregnancy, getDrawerDate(data.lastDelivery) ? `Last delivery: ${getDrawerDate(data.lastDelivery)}` : null]), 'pregnancy'),
            ]}
          />

          {previousPolicies.length > 0 && (
            <DrawerSection
              label={`Previous Policies (${previousPolicies.length})`}
              rows={previousPolicies.map((policy, index) => drawerRow(
                `Policy ${index + 1}`,
                joinDrawerValues([
                  policy.policyNumber ? `#${policy.policyNumber}` : null,
                  policy.branch ? `Branch: ${policy.branch}` : null,
                  policy.planTerm ? `Plan: ${policy.planTerm}` : null,
                  getDrawerMoney(policy.sumAssured) ? `${getDrawerMoney(policy.sumAssured)} cover` : null,
                  getDrawerMoney(policy.premium) ? `${getDrawerMoney(policy.premium)} premium` : null,
                  policy.mode ? `Mode: ${policy.mode}` : null,
                  policy.inforce ? `Status: ${policy.inforce}` : null,
                  getDrawerDate(policy.commencementDate) ? `DOC: ${getDrawerDate(policy.commencementDate)}` : null,
                ]),
                `previous-policy-${index}`,
              ))}
            />
          )}

          <DrawerSection
            label="Ownership & submission"
            rows={[
              drawerRow('Applicant / owner', record.ownerName, 'owner'),
              drawerRow('Submitted by', record.submittedByName, 'submitted-by'),
              drawerRow('Email', record.submittedByEmail, 'submitted-email'),
            ]}
          />
        </div>
        <div className="drawer-footer">
          <button className="button button-secondary" onClick={onClose} type="button">Close</button>
          <button className="button button-primary" onClick={() => onEdit(record)} type="button"><Icon name="edit" size={15} /> Edit record</button>
        </div>
      </aside>
    </div>
  );
}

function App() {
  const [role, setRole] = useState('agent');
  const [authSession, setAuthSession] = useState({
    loading: hasFirebaseConfig,
    user: null,
    error: null,
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [view, setViewState] = useState(() => getViewFromHash());
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(createInitialForm);
  const [activeStep, setActiveStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [browserDraft, setBrowserDraft] = useState(() => readDraftSnapshot());
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 840);
  const [demoDisplayName, setDemoDisplayName] = useState(() => getDemoProfileName('agent'));
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const inviteContext = useMemo(() => getInviteContext(), []);
  const autoIntakeOpened = useRef(false);
  const inviteAuthStarted = useRef(false);

  const isGuestMode = hasFirebaseConfig && ['guest', 'anonymous'].includes(authSession.user?.mode);
  const isAnonymousGuest = hasFirebaseConfig && authSession.user?.mode === 'anonymous';
  const user = hasFirebaseConfig
    ? isGuestMode
      ? authSession.user
      : { ...ROLE_USERS[role], ...authSession.user, roleLabel: role === 'agent' ? 'Agent' : 'Customer' }
    : { ...ROLE_USERS[role], name: demoDisplayName, initials: getInitials(demoDisplayName) };
  const scopedRecords = useMemo(
    () => records.filter((record) => user.role === 'agent' || record.ownerId === user.id),
    [records, user.id, user.role],
  );

  useEffect(() => {
    if (!hasFirebaseConfig) return undefined;
    return subscribeToAuth(({ user: signedInUser, error }) => {
      if (!signedInUser && !error && inviteContext.isInvite && !inviteAuthStarted.current) {
        inviteAuthStarted.current = true;
        setAuthSession({ loading: true, user: null, error: null });
        signInAnonymouslyUser()
          .then((guestUser) => {
            setAuthSession({ loading: false, user: guestUser, error: null });
            setRole('customer');
          })
          .catch((authError) => setAuthSession({ loading: false, user: null, error: authError }));
        return;
      }
      setAuthSession({ loading: false, user: signedInUser, error });
      if (signedInUser) setRole(signedInUser.role);
    });
  }, [inviteContext.isInvite]);

  useEffect(() => {
    if (hasFirebaseConfig || !inviteContext.isInvite || authSession.user) return;
    const guest = getGuestSession();
    setAuthSession({ loading: false, user: guest, error: null });
    setRole('customer');
  }, [authSession.user, inviteContext.isInvite]);

  useEffect(() => {
    const handleHashChange = () => setViewState(getViewFromHash());
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/overview');
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (hasFirebaseConfig && (authSession.loading || !authSession.user)) return undefined;
    let isMounted = true;
    loadRecords(authSession.user)
      .then((loadedRecords) => {
        if (!isMounted) return;
        setRecords(loadedRecords);
        const currentRole = authSession.user?.role || role;
        if (!autoIntakeOpened.current && (inviteContext.isInvite || (currentRole !== 'agent' && loadedRecords.length === 0))) {
          autoIntakeOpened.current = true;
          setView('form', { replace: true });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError(error.message || 'Records could not be loaded.');
          notify('Records could not be loaded. Check your Firebase connection.', 'error');
        }
      });
    return () => { isMounted = false; };
  }, [authSession.loading, authSession.user, inviteContext.isInvite, role]);

  useEffect(() => {
    if (view === 'form' && hasFormContent(form)) saveDraftSnapshot(form, authSession.user);
  }, [authSession.user, form, view]);

  useEffect(() => {
    setBrowserDraft(readDraftSnapshot(authSession.user));
  }, [authSession.user]);

  useEffect(() => {
    if (!hasFirebaseConfig) setDemoDisplayName(getDemoProfileName(role));
  }, [role]);

  useEffect(() => {
    if (profileOpen) {
      setProfileName(user.name);
      setProfileError('');
    }
  }, [profileOpen, user.name]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function notify(message, tone = 'success') {
    setToast({ message, tone });
  }

  async function handleCopyInviteLink() {
    const params = new URLSearchParams({
      invite: '1',
      inviteId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      agentId: user.id,
      agentName: user.name,
    });
    const url = new URL(window.location.href);
    url.search = `?${params.toString()}`;
    url.hash = '/form';

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Databook customer intake',
          text: 'Complete your insurance intake in Databook.',
          url: url.toString(),
        });
        notify('Customer intake link shared.');
        return;
      }
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await navigator.clipboard.writeText(url.toString());
      notify('Customer intake link copied. It opens as a guest and starts the form.');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      notify(error.message || 'The customer link could not be copied.', 'error');
    }
  }

  function setView(nextView, { replace = false } = {}) {
    setViewState(nextView);
    const nextHash = `#/${nextView}`;
    if (window.location.hash !== nextHash) {
      if (replace) {
        window.history.replaceState(null, '', nextHash);
      } else {
        window.history.pushState(null, '', nextHash);
      }
    }
  }

  function clearInviteUrl(nextView = 'records') {
    const cleanUrl = new URL(window.location.href);
    ['invite', 'inviteId', 'agentId', 'agentName'].forEach((key) => cleanUrl.searchParams.delete(key));
    cleanUrl.hash = `#/${nextView}`;
    window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    const nextName = profileName.trim();
    if (!nextName) {
      setProfileError('Enter a display name.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError('');
    try {
      if (!hasFirebaseConfig) {
        saveDemoProfileName(role, nextName);
        setDemoDisplayName(nextName);
      } else if (isGuestMode) {
        const guest = updateGuestDisplayName(nextName);
        setAuthSession((current) => ({ ...current, user: guest }));
      } else {
        const updatedUser = await updateUserDisplayName(nextName);
        setAuthSession({ loading: false, user: updatedUser, error: null });
        setRole(updatedUser.role);
      }
      setProfileOpen(false);
      notify('Your workspace name was updated.');
    } catch (error) {
      setProfileError(error.message || 'The name could not be updated.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSignIn(email, password) {
    setIsSigningIn(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setAuthSession((current) => ({ ...current, error }));
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignUp(email, password, displayName) {
    setIsSigningIn(true);
    try {
      await createAccount(email, password, displayName);
    } catch (error) {
      setAuthSession((current) => ({ ...current, error }));
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleClearAuthError() {
    setAuthSession((current) => ({ ...current, error: null }));
  }

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthSession((current) => ({ ...current, error }));
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleContinueGuest() {
    const guest = getGuestSession();
    setRole('customer');
    setAuthSession({ loading: false, user: guest, error: null });
    setRecords([]);
    setSelectedRecord(null);
    setLoadError('');
    autoIntakeOpened.current = true;
    setView('form', { replace: true });
    notify('Guest mode enabled. Your entries will stay in this browser.');
  }

  async function handleExitGuest() {
    try {
      await signOutUser();
    } catch (error) {
      notify(error.message || 'Could not leave guest mode.', 'error');
      return;
    }
    setAuthSession({ loading: false, user: null, error: null });
    setRecords([]);
    setSelectedRecord(null);
    setBrowserDraft(null);
    setProfileOpen(false);
    setView('overview');
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      setRecords([]);
      setProfileOpen(false);
      setView('overview');
    } catch (error) {
      notify(error.message || 'Could not sign out.', 'error');
    }
  }

  function handleChange(field, value) {
    const normalizedValue = normalizeFieldValue(field, value);
    setForm((current) => {
      const updated = {
        ...current,
        [field]: normalizedValue,
      };

      if (field === 'dateOfBirth') {
        updated.age = calculateAge(normalizedValue);
      }

      if (field === 'corrSameKyc') {
        if (normalizedValue) {
          updated.corrAddress = current.address;
        }
      }

      if (field === 'address' && current.corrSameKyc) {
        updated.corrAddress = value;
      }

      return updated;
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleRepeaterChange(type, index, field, value) {
    const normalizedValue = normalizeFieldValue(field, value);
    setForm((current) => ({
      ...current,
      [type]: current[type].map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updatedItem = { ...item, [field]: normalizedValue };
        if (type === 'nominees' && field === 'dob') {
          updatedItem.age = calculateAge(normalizedValue);
        }
        return updatedItem;
      }),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`${type}-${index}-${field}`];
      delete next[type];
      return next;
    });
  }

  function handleAddRepeater(type) {
    const templates = {
      nominees: { name: '', relation: '', share: '0', dob: '', age: '', aadhaar: '', phone: '' },
      siblings: { relation: 'Brother', age: '', health: 'Good', diedAge: '', diedYear: '', diedCause: '' },
      children: { age: '', health: 'Good', diedAge: '', diedYear: '', diedCause: '' },
      previousPolicies: {
        policyNumber: '',
        branch: '',
        planTerm: '',
        sumAssured: '',
        premium: '',
        mode: 'Yearly',
        accidentalBenefit: '',
        commencementDate: '',
        rateAccepted: 'Ordinary Rate',
        medicalType: 'Medical',
        inforce: 'Yes',
      },
    };
    setForm((current) => ({ ...current, [type]: [...current[type], templates[type]] }));
  }

  function handleRemoveRepeater(type, index) {
    setForm((current) => ({ ...current, [type]: current[type].filter((_item, itemIndex) => itemIndex !== index) }));
  }

  function openNewForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setActiveStep(0);
    setHighestStep(0);
    setFieldErrors({});
    setView('form');
  }

  function continueBrowserDraft() {
    const draft = readDraftSnapshot(authSession.user);
    if (!draft) {
      notify('That browser draft is no longer available.', 'error');
      setBrowserDraft(null);
      return;
    }
    setForm(normalizeForm(draft));
    setEditingId(null);
    setActiveStep(0);
    setHighestStep(0);
    setFieldErrors({});
    setView('form');
    notify('Draft restored. Continue where you left off.');
  }

  function openEdit(record) {
    setForm(normalizeForm(record.formData));
    setEditingId(record.id);
    setActiveStep(0);
    setHighestStep(STEPS.length - 1);
    setFieldErrors({});
    setSelectedRecord(null);
    setView('form');
  }

  function handleStepChange(nextStep) {
    if (nextStep < 0 || nextStep >= STEPS.length) return;
    setActiveStep(nextStep);
    setHighestStep((current) => Math.max(current, nextStep));
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNext() {
    const errors = validateStep(activeStep, form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      notify('Complete the highlighted details before continuing.', 'error');
      return;
    }
    handleStepChange(activeStep + 1);
  }

  function buildRecord(status, session = authSession.user) {
    const existing = records.find((record) => record.id === editingId);
    const now = new Date().toISOString();
    const submittedByName = role === 'agent'
      ? user.name || session?.name || 'Rapolu Venkateshwarlu'
      : session?.mode === 'anonymous'
        ? (session?.name || 'Guest')
        : session?.name || user.name || 'Unknown user';
    const submittedByMode = session?.mode === 'anonymous'
      ? 'anonymous'
      : session?.mode === 'guest'
        ? 'local-guest'
        : 'authenticated';
    const isLegacyImportedRecord = existing && (
      Number.isInteger(existing.importOrder)
      || (!existing.submissionMode && !existing.submittedAt)
    );
    const recordId = editingId || createRecordId();
    const caseNumber = existing?.caseNumber || (editingId ? existing?.id || recordId : createCaseNumber());
    return {
      ...(existing || {}),
      id: recordId,
      caseNumber,
      ownerId: session?.mode === 'anonymous'
        ? session.id
        : existing?.ownerId || session?.id || user.id,
      ownerName: form.fullName || existing?.ownerName || 'Unnamed customer',
      agentName: role === 'agent' ? user.name : existing?.agentName || 'Riya Menon',
      invitedById: existing?.invitedById || inviteContext.invitedById || '',
      invitedByName: existing?.invitedByName || inviteContext.invitedByName || '',
      inviteId: existing?.inviteId || inviteContext.inviteId || '',
      submittedById: existing?.submittedById || session?.id || user.id,
      submittedByName: existing?.submittedByName || submittedByName,
      submittedByEmail: existing?.submittedByEmail || session?.email || '',
      submittedByMode: existing?.submittedByMode || submittedByMode,
      applicantName: form.fullName || 'Unnamed applicant',
      planName: form.planName || 'Plan not selected',
      premium: Number(form.premium || 0),
      sumAssured: Number(form.sumAssured || 0),
      status,
      submissionMode: submittedByMode,
      submittedAt: existing?.submittedAt || (status === 'submitted' && !isLegacyImportedRecord ? now : null),
      updatedAt: now,
      formData: form,
    };
  }

  async function persistRecord(status, session = authSession.user) {
    setIsSaving(true);
    try {
      const record = buildRecord(status, session);
      const result = await saveRecord(record, session);
      setRecords((current) => result.records || [record, ...current.filter((item) => item.id !== record.id)]);
      return record;
    } catch (error) {
      const message = error?.code === 'permission-denied' || /Missing or insufficient permissions/i.test(error?.message || '')
        ? 'Firebase rejected this record. Publish the latest firestore.rules to the same Firebase project, then try again.'
        : error.message || 'The record could not be saved.';
      notify(message, 'error');
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    const record = await persistRecord('draft');
    if (!record) return;
    setEditingId(record.id);
    setBrowserDraft(form);
    notify(`${record.caseNumber || record.id} saved as a draft.`);
  }

  async function handleSubmit() {
    const errors = validateAll(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstErrorStep = STEPS.slice(0, -1).findIndex((_step, index) => Object.keys(validateStep(index, form)).length > 0);
      setActiveStep(firstErrorStep >= 0 ? firstErrorStep : 0);
      notify('A few required details still need attention.', 'error');
      return;
    }

    let submitSession = authSession.user;
    if (submitSession?.mode === 'guest') {
      try {
        submitSession = await signInAnonymouslyUser();
        setAuthSession({ loading: false, user: submitSession, error: null });
        setRole('customer');
      } catch (error) {
        notify('Guest submission needs Firebase Anonymous Authentication enabled. No data was uploaded.', 'error');
        return;
      }
    }

    const record = await persistRecord('submitted', submitSession);
    if (!record) return;
    clearDraftSnapshot(submitSession?.mode === 'anonymous' ? authSession.user : submitSession);
    setBrowserDraft(null);
    if (submitSession?.mode === 'anonymous' && authSession.user?.mode === 'guest') {
      setRecords([record]);
    }
    setEditingId(null);
    if (inviteContext.isInvite) clearInviteUrl('records');
    setView('records');
    setActiveStep(0);
    notify(`${record.caseNumber || record.id} submitted and ready for review.`);
  }

  async function handleDelete(record) {
    const confirmed = window.confirm(`Delete ${record.caseNumber || record.id}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await removeRecord(record.id, authSession.user);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setSelectedRecord(null);
      notify(`${record.caseNumber || record.id} was deleted.`);
    } catch (error) {
      notify(error.message || 'The record could not be deleted.', 'error');
    }
  }

  async function handleDeleteMultiple(idsToDelete) {
    if (!idsToDelete || idsToDelete.length === 0) return;
    try {
      await removeRecords(idsToDelete, authSession.user);
      const idSet = new Set(idsToDelete);
      setRecords((current) => current.filter((item) => !idSet.has(item.id)));
      if (selectedRecord && idSet.has(selectedRecord.id)) {
        setSelectedRecord(null);
      }
      notify(`${idsToDelete.length} ${idsToDelete.length === 1 ? 'record was' : 'records were'} deleted.`);
    } catch (error) {
      notify(error.message || 'Failed to delete selected records.', 'error');
    }
  }

  function handleImport(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    importRecords(file, authSession.user)
      .then((imported) => {
        setRecords(imported);
        notify(`${imported.length} records imported.`);
      })
      .catch((error) => notify(error.message || 'The file could not be imported.', 'error'))
      .finally(() => { event.target.value = ''; });
  }

  function handleRoleChange(nextRole) {
    if (hasFirebaseConfig) return;
    setRole(nextRole);
    setProfileOpen(false);
    setSelectedRecord(null);
    setView('overview');
    setSearch('');
    setStatusFilter('all');
  }

  function toggleSidebar() {
    setSidebarOpen((current) => !current);
  }

  function navigateToView(nextView) {
    setView(nextView);
    if (window.innerWidth <= 840) setSidebarOpen(false);
  }

  if (hasFirebaseConfig && authSession.loading) {
    return <AuthLoading />;
  }

  if (hasFirebaseConfig && !authSession.user) {
    return <SignInView error={getAuthErrorMessage(authSession.error)} isSigningIn={isSigningIn} onClearError={handleClearAuthError} onContinueGuest={handleContinueGuest} onGoogleSignIn={handleGoogleSignIn} onSignIn={handleSignIn} onSignUp={handleSignUp} />;
  }

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true"><span className="brand-mark-line" /></span>
            <div><strong>databook</strong><small>insurance data</small></div>
          </div>
          <button aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} className="sidebar-collapse-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} type="button">
            <Icon name="menu" size={17} />
          </button>
        </div>
        <div className="sidebar-body">
          <div className="sidebar-divider" />
          <div className="mobile-account-actions" aria-label="Account actions">
            <button aria-label="Edit profile name" className="user-more" onClick={() => setProfileOpen((current) => !current)} title="Edit profile name" type="button"><Icon name="edit" size={15} /></button>
            {hasFirebaseConfig && <button aria-label={isGuestMode ? 'Exit guest mode' : 'Sign out'} className="user-more" onClick={isGuestMode ? handleExitGuest : handleSignOut} title={isGuestMode ? 'Exit guest mode' : 'Sign out'} type="button"><Icon name="logout" size={15} /></button>}
          </div>
          {!hasFirebaseConfig && <div className="role-switcher">
            <span className="sidebar-label">Viewing as</span>
            <div className="role-toggle" role="group" aria-label="Choose workspace role">
              <button className={role === 'agent' ? 'is-active' : ''} onClick={() => handleRoleChange('agent')} type="button">Agent</button>
              <button className={role === 'customer' ? 'is-active' : ''} onClick={() => handleRoleChange('customer')} type="button">Customer</button>
            </div>
          </div>}
          <nav className="main-nav" aria-label="Main navigation">
            <span className="sidebar-label">Workspace</span>
            <button className={view === 'overview' ? 'nav-item is-active' : 'nav-item'} onClick={() => navigateToView('overview')} type="button"><Icon name="grid" size={18} /><span>Overview</span><span className="nav-marker" /></button>
            <button className={view === 'records' ? 'nav-item is-active' : 'nav-item'} onClick={() => navigateToView('records')} type="button"><Icon name="file" size={18} /><span>{role === 'agent' ? 'Submissions' : 'My submissions'}</span><span className="nav-count">{scopedRecords.length}</span></button>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="security-note"><Icon name={isGuestMode ? 'info' : 'shield'} size={17} /><div><strong>{isGuestMode ? 'Guest mode' : 'Role-aware by design'}</strong><span>{isAnonymousGuest ? 'Submitted records sync securely.' : isGuestMode ? 'Records stay on this device.' : 'Private information stays in scope.'}</span></div></div>
          <div className="user-card">
            <span className="avatar">{user.initials}</span>
            <div><strong>{user.name}</strong><span>{user.roleLabel} workspace</span></div>
            <div className="user-actions">
              <button aria-label="Edit profile name" className="user-more" onClick={() => setProfileOpen((current) => !current)} title="Edit profile name" type="button"><Icon name="edit" size={14} /></button>
              {hasFirebaseConfig && <button aria-label={isGuestMode ? 'Exit guest mode' : 'Sign out'} className="user-more" onClick={isGuestMode ? handleExitGuest : handleSignOut} title={isGuestMode ? 'Exit guest mode' : 'Sign out'} type="button"><Icon name="logout" size={15} /></button>}
            </div>
          </div>
          {profileOpen && <ProfileEditor error={profileError} isSaving={isSavingProfile} name={profileName} onCancel={() => setProfileOpen(false)} onChange={setProfileName} onSave={handleSaveProfile} />}
        </div>
      </aside>
      <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setSidebarOpen(false)} type="button" />
      <main className="main-content">
        <div className="mobile-topbar">
          <div className="mobile-brand-lockup">
            <span className="brand-mark" aria-hidden="true"><span className="brand-mark-line" /></span>
            <div><strong>databook</strong><small>insurance data</small></div>
          </div>
          <button aria-expanded={sidebarOpen} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} className="sidebar-toggle mobile-sidebar-toggle" onClick={toggleSidebar} type="button">
            <Icon name="menu" size={19} />
          </button>
        </div>
        {loadError && <div className="load-error" role="alert"><Icon name="info" size={16} />{loadError}</div>}
        {view === 'overview' && <OverviewView browserDraft={browserDraft} currentTime={currentTime} isAnonymousGuest={isAnonymousGuest} isGuest={isGuestMode} onContinueDraft={continueBrowserDraft} onCopyInviteLink={handleCopyInviteLink} onExitGuest={handleExitGuest} onStartNew={openNewForm} onViewRecords={() => setView('records')} records={scopedRecords} role={role} user={user} />}
        {view === 'records' && (
          <RecordsView
            isAnonymousGuest={isAnonymousGuest}
            isGuest={isGuestMode}
            onDelete={handleDelete}
            onDeleteMultiple={handleDeleteMultiple}
            onEdit={openEdit}
            onExport={() => { exportRecords(scopedRecords); notify('Export started.'); }}
            onImport={handleImport}
            onOpen={setSelectedRecord}
            onStartNew={openNewForm}
            records={scopedRecords}
            role={role}
            search={search}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />
        )}
        {view === 'form' && <FormView activeStep={activeStep} editingId={editingId} fieldErrors={fieldErrors} form={form} highestStep={highestStep} isAnonymousGuest={isAnonymousGuest} isGuest={isGuestMode} isSaving={isSaving} onAddRepeater={handleAddRepeater} onBack={() => setView('overview')} onChange={handleChange} onNext={handleNext} onRemoveRepeater={handleRemoveRepeater} onRepeaterChange={handleRepeaterChange} onSaveDraft={handleSaveDraft} onStepChange={handleStepChange} onSubmit={handleSubmit} role={role} user={user} />}
      </main>

      <RecordDrawer onClose={() => setSelectedRecord(null)} onEdit={openEdit} record={selectedRecord} />
      {toast && <div aria-live="polite" className={`toast toast-${toast.tone}`}><span className="toast-icon"><Icon name={toast.tone === 'error' ? 'info' : 'check'} size={15} /></span><span>{toast.message}</span><button aria-label="Dismiss message" className="toast-close" onClick={() => setToast(null)} type="button"><Icon name="close" size={15} /></button></div>}
    </div>
  );
}

export default App;
