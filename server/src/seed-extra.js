// Communities and case studies seed (idempotent: only inserts when the tables are empty)
export const COMMUNITIES = [
  { slug: 'anatomy-study-circle', name: 'Anatomy Study Circle', tag: 'Anatomy', description: 'Share mnemonics, dissection tips and regional anatomy questions.' },
  { slug: 'micro-lab-talk', name: 'Microbiology Lab Talk', tag: 'Microbiology', description: 'Gram stains, culture techniques and antimicrobial stewardship discussion.' },
  { slug: 'hematology-hub', name: 'Hematology Hub', tag: 'Hematology', description: 'Blood counts, smear interpretation and anemia workups.' },
];

export const CASE_STUDIES = [
  {
    slug: 'chest-pain-young-adult',
    title: 'Sudden chest pain after a long flight',
    specialty: 'Cardiopulmonary',
    patient: '34-year-old woman',
    presentation: 'Presents with 6 hours of pleuritic right-sided chest pain and shortness of breath. Returned from a 10-hour flight two days ago. Takes an oral contraceptive. No prior cardiac history. Mild tachycardia on exam; calf is tender and mildly swollen on the right.',
    vitals: 'HR 108, BP 118/74, RR 22, SpO2 93% on room air, Temp 37.1 C',
    questions: [
      { stage: 'diagnosis', prompt: 'What is the most likely diagnosis?', options: ['Acute pulmonary embolism', 'Pneumothorax', 'Acute myocardial infarction', 'Costochondritis'], correct_index: 0, explanation: 'Pleuritic pain, dyspnea, tachycardia, hypoxemia, a provoking factor (long travel, estrogen) and a swollen tender calf together point to pulmonary embolism from deep vein thrombosis.' },
      { stage: 'lab', prompt: 'Which first-line test best risk-stratifies her suspected PE alongside clinical scoring?', options: ['D-dimer', 'Serum troponin I alone', 'Blood culture', 'Serum lipase'], correct_index: 0, explanation: 'In a low to intermediate pretest probability patient a negative D-dimer rules out PE. A positive result leads to CT pulmonary angiography. Troponin can add prognostic information once PE is confirmed.' },
      { stage: 'lab', prompt: 'Imaging confirms a filling defect in the right pulmonary artery. Which test should be ordered next to assess right ventricular strain?', options: ['Bedside echocardiogram or CT right/left ventricle ratio', 'Lumbar puncture', 'Abdominal ultrasound', 'Sputum culture'], correct_index: 0, explanation: 'Echocardiography and CT RV/LV ratio identify right ventricular dysfunction, which changes risk category and management intensity.' },
      { stage: 'treatment', prompt: 'What is the appropriate initial treatment?', options: ['Therapeutic anticoagulation (for example low molecular weight heparin, then a DOAC)', 'Aspirin alone', 'Immediate thrombolysis for all patients', 'Observation without anticoagulation'], correct_index: 0, explanation: 'Hemodynamically stable PE is treated with anticoagulation. Thrombolysis is reserved for high-risk PE with hypotension. Stopping the oral contraceptive is usually recommended after the acute event.' },
      { stage: 'explanation', prompt: 'Why is the oral contraceptive relevant and what should happen to it?', options: ['Estrogen raises clotting risk, so it is a provoking factor to review with a clinician', 'It causes pneumothorax', 'It has no effect on clotting', 'It lowers oxygen saturation directly'], correct_index: 0, explanation: 'Estrogen-containing contraception increases venous thromboembolism risk. Discuss alternatives with the patient once anticoagulation is established.' },
    ],
  },
  {
    slug: 'fever-and-neck-stiffness',
    title: 'Fever, headache and neck stiffness',
    specialty: 'Infectious disease',
    patient: '19-year-old university student',
    presentation: 'Two days of fever, severe headache, photophobia and neck stiffness. Vomited twice. Lives in a shared hostel. Petechial rash noted on the lower legs.',
    vitals: 'HR 122, BP 96/60, RR 24, Temp 39.4 C, GCS 14',
    questions: [
      { stage: 'diagnosis', prompt: 'Which diagnosis must be treated as an emergency?', options: ['Bacterial meningitis (meningococcal suspected)', 'Tension headache', 'Migraine without aura', 'Sinusitis'], correct_index: 0, explanation: 'Fever, meningism, altered alertness and petechiae in a crowded setting make meningococcal meningitis the leading concern. This is a time-critical emergency.' },
      { stage: 'lab', prompt: 'Before lumbar puncture, which imaging step is recommended if there is focal deficit, papilledema or reduced consciousness?', options: ['CT head to exclude raised intracranial pressure', 'Chest X-ray', 'Abdominal CT', 'MRI of the spine only'], correct_index: 0, explanation: 'A CT head is done first in those cases to avoid herniation risk from lumbar puncture. Blood cultures should be taken without delaying antibiotics.' },
      { stage: 'lab', prompt: 'Which cerebrospinal fluid pattern supports bacterial meningitis?', options: ['High neutrophil count, high protein, low glucose', 'Normal cell count, normal protein, normal glucose', 'Lymphocytic pleocytosis with normal glucose only', 'Red cells only with no white cells'], correct_index: 0, explanation: 'Bacterial meningitis typically shows neutrophilic pleocytosis, raised protein and low CSF glucose relative to blood glucose.' },
      { stage: 'treatment', prompt: 'What is the correct first treatment?', options: ['Give empirical IV antibiotics immediately, then adjuncts such as dexamethasone where indicated', 'Wait for culture results for 48 hours', 'Oral paracetamol only', 'Antifungal therapy'], correct_index: 0, explanation: 'Empirical third-generation cephalosporin plus vancomycin is started as soon as possible. Dexamethasone is given before or with the first antibiotic dose per local guidelines. Contacts also need chemoprophylaxis.' },
      { stage: 'explanation', prompt: 'Why are close contacts in the hostel given prophylaxis?', options: ['Neisseria meningitidis spreads by respiratory droplets and close contacts are at raised risk', 'The disease is not contagious', 'Contacts already have the infection', 'Prophylaxis treats fever'], correct_index: 0, explanation: 'Close contacts of meningococcal disease are offered antibiotic prophylaxis to prevent secondary cases.' },
    ],
  },
];

export const COMMUNITY_THREADS = [
  { community: 'anatomy-study-circle', title: 'Mnemonic for the brachial plexus cords?', body: 'Lateral, posterior, medial cords are easy, but I keep mixing up the branches. What helps you?', replies: ['Try "Lazy Lions Play Poker" for the terminal branches of the cords. Cord-to-branch order is the hard part.'] },
  { community: 'micro-lab-talk', title: 'Gram-positive vs negative on thick smears', body: 'Got a purple/pink mix on my slide. Probably too thick. Advice on re-prep?', replies: ['Thin the smear, air dry fully, heat fix gently. Stain time matters more than people think.'] },
  { community: 'hematology-hub', title: 'Microcytic anemia: iron deficiency vs thalassemia trait', body: 'What indices do you lean on first in exam questions?', replies: ['MCV low with high RDW often points to iron deficiency. Mentzer index under 13 leans toward thalassemia trait.'] },
];

export const DEMO_COMMUNITY_MEMBERS = ['student@biomedaccess.local'];
