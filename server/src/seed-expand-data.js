// Starter content for the expansion seed (idempotent, see seed-expand.js).
// Every course is free. Each topic has one short content stub (subtopic body).

export const EXPANSION_COURSES = [
  {
    slug: 'haematology-blood-transfusion',
    title: 'Haematology & Blood Transfusion',
    level: 'Intermediate',
    description: 'Blood cell morphology, full blood count interpretation and the principles of safe blood transfusion. Covers the ABO and Rh systems, pre-transfusion testing and how to recognise and investigate transfusion reactions. Built for lab scientists working in blood banks and hospital labs.',
    topics: [
      { title: 'Blood Group Systems (ABO and Rh)', description: 'Antigens, antibodies and the basics of blood grouping.', body: 'ABO grouping relies on the A and B antigens on red cells and the naturally occurring anti-A and anti-B antibodies in plasma. Rh (D) status is determined with anti-D reagents, and an Rh negative patient needs Rh negative red cells where possible. Always confirm forward and reverse grouping before issuing blood.' },
      { title: 'Pre-transfusion Testing and Crossmatch', description: 'Antibody screening, compatibility testing and sample checks.', body: 'Pre-transfusion testing includes a patient ABO and Rh group, an antibody screen and an electronic or serological crossmatch. The sample must be labelled correctly and within its validity window. Any discrepancy must stop issue until it is resolved.' },
      { title: 'Transfusion Reactions', description: 'Recognising, investigating and reporting adverse transfusion events.', body: 'Acute reactions include haemolytic, febrile and allergic reactions, and they need immediate stopping of the transfusion. Investigation starts with a repeat ABO group, a direct antiglobulin test and a review of the clinical picture. Every suspected reaction must be recorded and reported through the hospital haemovigilance process.' },
    ],
  },
  {
    slug: 'clinical-chemistry',
    title: 'Clinical Chemistry',
    level: 'Intermediate',
    description: 'The biochemical tests used to diagnose and monitor disease, from electrolytes and renal function to glucose and liver markers. Covers analyser principles, reference intervals and quality control. Designed for laboratory scientists preparing for routine chemistry work.',
    topics: [
      { title: 'Electrolytes and Acid-Base Balance', description: 'Sodium, potassium, chloride, bicarbonate and blood gases.', body: 'Sodium, potassium, chloride and bicarbonate are measured by ion-selective electrodes on routine analysers. The anion gap helps separate causes of metabolic acidosis. Haemolysis can falsely raise potassium, so sample handling affects the result.' },
      { title: 'Liver and Renal Function Tests', description: 'ALT, AST, bilirubin, urea and creatinine.', body: 'ALT and AST reflect hepatocyte injury, while bilirubin and alkaline phosphatase help separate cholestatic from hepatocellular patterns. Creatinine and urea are used with estimated glomerular filtration rate to assess kidney function. Interpret results against the reference interval for age and sex.' },
      { title: 'Glucose and Diabetes Markers', description: 'Fasting glucose, glycated haemoglobin and the oral glucose tolerance test.', body: 'Fasting plasma glucose and HbA1c are the main tests for diabetes diagnosis and monitoring. Glucose in fluoride tubes is stable, but delayed separation in other tubes causes falsely low results. HbA1c reflects average glucose over about 2 to 3 months.' },
      { title: 'Quality Control in Chemistry', description: 'Levey-Jennings charts, Westgard rules and corrective action.', body: 'Two control levels are run each shift and plotted on Levey-Jennings charts against their target mean and standard deviation. Westgard rules flag random and systematic error before patient results are released. Any rule violation requires investigation and documented corrective action.' },
    ],
  },
  {
    slug: 'parasitology',
    title: 'Parasitology',
    level: 'Intermediate',
    description: 'Protozoa, helminths and the laboratory methods used to find them in blood, stool and tissue. Covers malaria microscopy, concentration techniques and the morphology you need to identify common parasites. Relevant to lab scientists working in clinical and public health laboratories across Africa.',
    topics: [
      { title: 'Protozoa of Medical Importance', description: 'Entamoeba, Giardia, Plasmodium and Trypanosoma.', body: 'Medically important protozoa include Entamoeba histolytica, Giardia intestinalis, Plasmodium species and Trypanosoma species. Identification depends on trophozoite and cyst morphology, nuclear detail and the stage found in the sample. Several of these need specific stains or concentration methods to be seen reliably.' },
      { title: 'Helminths: Nematodes, Cestodes and Trematodes', description: 'Egg and larval morphology for common worm infections.', body: 'Helminths are identified mainly by egg and larval morphology in stool, urine or blood. Common examples include Ascaris lumbricoides, hookworm, Schistosoma haematobium and Taenia species. Egg size, shape, shell and internal structure are the key identifying features.' },
      { title: 'Malaria Microscopy', description: 'Thick and thin blood films, staining and species identification.', body: 'Thick films detect parasites with high sensitivity and thin films allow species identification and parasite counting. Giemsa stain is standard, and the thick film must be dehydrated and stained carefully to avoid lysis. Results should be reported with species and parasite density, and a negative result needs repeat examination over time.' },
      { title: 'Stool Examination Methods', description: 'Direct smear, concentration and formol-ether techniques.', body: 'Direct wet mounts show motile trophozoites but miss many cysts and eggs. Concentration methods such as formol-ether sedimentation increase detection of eggs and cysts. A single negative stool does not exclude infection, so the examination is often repeated on separate days.' },
    ],
  },
  {
    slug: 'histopathology-cytology',
    title: 'Histopathology & Cytology',
    level: 'Intermediate',
    description: 'From tissue fixation and processing to H&E staining and cytology smears, this course covers the workflow of a histology lab. You will learn the basics of tissue handling, staining quality and fine needle aspiration. Written for lab scientists who support pathologists in diagnostic labs.',
    topics: [
      { title: 'Tissue Fixation and Processing', description: 'Formalin fixation, dehydration, clearing and embedding.', body: 'Fixation with buffered formalin preserves tissue architecture and stops autolysis. Processing removes water with graded alcohols, clears with xylene and embeds in paraffin wax. Under-fixed or poorly processed tissue leads to artefacts that can mislead the pathologist.' },
      { title: 'Staining: Haematoxylin and Eosin', description: 'The routine H&E stain and checking stain quality.', body: 'Haematoxylin stains nuclei blue and eosin stains cytoplasm and extracellular matrix pink. Good progression, timing and differentiation give clear nuclear detail. Check each batch with a control slide and review sections for over- or under-staining.' },
      { title: 'Fine Needle Aspiration Cytology', description: 'Specimen collection, smear preparation and adequacy.', body: 'Fine needle aspiration samples cells with a thin needle, and the material is smeared, air-dried or fixed depending on the stain required. Adequacy is judged by cellularity and the presence of diagnostic cells. Inadequate samples should be reported as such and repeated where clinically needed.' },
      { title: 'Cervical Cytology (Pap Smear) Basics', description: 'Sample collection, fixation and Bethesda reporting.', body: 'Cervical cytology smears are fixed promptly to avoid air drying artefacts. Samples are reported using the Bethesda system, which grades the findings and states adequacy. Clear labelling and fixation timing are essential for accurate reporting.' },
    ],
  },
  {
    slug: 'medical-virology',
    title: 'Medical Virology',
    level: 'Intermediate',
    description: 'Virus structure, classification and the diagnostic methods used in clinical virology, from antigen detection to molecular testing. Covers HIV and hepatitis laboratory testing with an emphasis on sample integrity and result interpretation. Useful for lab scientists in virology, serology and molecular diagnostic labs.',
    topics: [
      { title: 'Virus Structure and Classification', description: 'Capsids, envelopes, genomes and the main virus families.', body: 'Viruses are classified by genome type (DNA or RNA, single or double stranded), capsid symmetry and the presence of an envelope. These features influence stability, transmission and how the virus is detected in the lab. Knowing the main families helps you choose the right diagnostic test.' },
      { title: 'Viral Detection: Antigen Tests and Molecular Diagnosis', description: 'PCR, RT-PCR and rapid antigen methods.', body: 'Molecular methods such as PCR and RT-PCR detect viral nucleic acid with high sensitivity, and they need strict contamination control. Antigen tests are faster but less sensitive, especially early in infection. Results must be interpreted with the timing of sampling and the clinical picture.' },
      { title: 'HIV Laboratory Testing', description: 'Screening algorithms, confirmatory testing and viral load.', body: 'HIV testing usually uses a combined antigen and antibody screen followed by a confirmatory or differentiation test. Viral load monitoring guides treatment response, and early infant diagnosis uses nucleic acid testing. Follow your national algorithm and document every step of the result.' },
      { title: 'Hepatitis Viruses', description: 'Hepatitis B and C serology and viral load testing.', body: 'Hepatitis B is assessed with HBsAg, anti-HBc and anti-HBs, and the pattern shows whether infection is acute, chronic or past. Hepatitis C is screened with antibody testing and confirmed with RNA testing. Interpret serology together with clinical history and vaccination status.' },
    ],
  },
  {
    slug: 'immunology-serology',
    title: 'Immunology & Serology',
    level: 'Intermediate',
    description: 'The immune response, antigen-antibody reactions and the serological tests used in routine diagnosis. Covers immunoglobulin classes, ELISA principles and common agglutination and precipitation tests. Built for lab scientists who run and interpret serology assays.',
    topics: [
      { title: 'Innate and Adaptive Immunity', description: 'Barriers, phagocytes, lymphocytes and antibody production.', body: 'Innate immunity responds quickly through barriers, phagocytes and complement, while adaptive immunity develops specific responses through T and B lymphocytes. Memory cells explain why a second exposure produces a faster and stronger response. This is the basis for vaccination and for many serological tests.' },
      { title: 'Antigen-Antibody Reactions', description: 'Affinity, avidity and the main reaction types.', body: 'Antigen-antibody binding depends on affinity for a single epitope and avidity across multiple sites. Agglutination and precipitation are visible reactions used in many routine tests. Prozone effects and excess antigen can give false negatives, so titres and dilutions matter.' },
      { title: 'ELISA and Serological Tests', description: 'Principle, controls and reading an ELISA plate.', body: 'ELISA detects antigen or antibody by an enzyme-linked colour change read on a plate reader. Each run needs positive, negative and blank controls, and the cut-off must be checked against the kit validation. Results are reported as positive, negative or indeterminate according to the manufacturer and local protocol.' },
      { title: 'Immunoglobulin Classes', description: 'IgG, IgM, IgA, IgE and IgD and their clinical meaning.', body: 'IgM appears first in acute infection, while IgG is the main class in later and long-term immunity. IgA is found in mucosal secretions and IgE is linked to allergy and parasitic infection. Knowing which class a test detects helps interpret whether an infection is recent or past.' },
    ],
  },
  {
    slug: 'medical-entomology',
    title: 'Medical Entomology',
    level: 'Beginner',
    description: 'Arthropods that transmit disease to humans, with a focus on mosquitoes, tsetse flies and other vectors common in Zambia and the wider region. Covers identification, vector biology and the principles of vector control. Useful for lab scientists and public health staff working on vector-borne diseases.',
    topics: [
      { title: 'Arthropod Vectors of Disease', description: 'Key vector groups and the diseases they transmit.', body: 'Medically important arthropods include mosquitoes, tsetse flies, sand flies, ticks, fleas and lice. Each group transmits specific pathogens, and the transmission route depends on the vector biology. Knowing the vector is the first step in breaking transmission.' },
      { title: 'Mosquitoes and Malaria Vectors', description: 'Anopheles identification and the vector life cycle.', body: 'Malaria is transmitted by female Anopheles mosquitoes, which need blood meals for egg development and breed in clean or still water. Larvae and adults are identified by morphology, including the palps and wing markings. Vector density and feeding behaviour affect local transmission.' },
      { title: 'Tsetse Flies and Trypanosomiasis', description: 'Vector biology and the spread of sleeping sickness.', body: 'Tsetse flies transmit Trypanosoma species that cause human and animal trypanosomiasis. They feed on blood and have a slow reproductive cycle, which makes control in the field possible. Surveillance combines trap catches with human case detection.' },
      { title: 'Vector Control Principles', description: 'Larval source management, insecticides and bed nets.', body: 'Integrated vector control combines larval source management, insecticide-treated nets, indoor residual spraying and environmental measures. Insecticide resistance must be monitored with standard bioassays. Control programmes should be evaluated against entomological and disease indicators.' },
    ],
  },
  {
    slug: 'anatomy-physiology',
    title: 'Anatomy & Physiology',
    level: 'Beginner',
    description: 'The structure and function of the major body systems, with a focus on the physiology behind common lab tests. Covers cell physiology, cardiovascular, respiratory and renal function. A solid base for lab scientists who need to link test results to the body.',
    topics: [
      { title: 'Cell Physiology and Homeostasis', description: 'Body fluids, membrane transport and feedback control.', body: 'Body fluids are divided into intracellular and extracellular compartments, and cell membranes control the movement of ions and water. Homeostasis relies on negative feedback loops to keep values such as pH, temperature and glucose within narrow limits. Many lab tests measure these homeostatic systems.' },
      { title: 'Cardiovascular Physiology', description: 'Cardiac output, blood pressure and circulation.', body: 'Cardiac output is the product of heart rate and stroke volume, and blood pressure depends on cardiac output and peripheral resistance. The heart valves and conduction system set the rhythm of contraction. Cardiac biomarkers such as troponin reflect myocardial injury.' },
      { title: 'Respiratory System', description: 'Ventilation, gas exchange and oxygen transport.', body: 'Ventilation moves air in and out of the lungs, and gas exchange happens across the alveolar membrane. Oxygen is carried mainly bound to haemoglobin, and carbon dioxide is carried as bicarbonate. Blood gas results reflect how well these processes are working.' },
      { title: 'Renal Physiology', description: 'Filtration, reabsorption and secretion in the nephron.', body: 'The nephron filters plasma at the glomerulus and then reabsorbs and secretes substances along the tubule. Glomerular filtration rate is the main measure of kidney function. Creatinine clearance and urine tests reflect how well the nephron is working.' },
    ],
  },
  {
    slug: 'pharmacology',
    title: 'Pharmacology',
    level: 'Intermediate',
    description: 'How drugs move through the body and how they act, with a focus on antimicrobial agents and drug safety. Covers pharmacokinetics, pharmacodynamics and the monitoring of adverse reactions. Relevant to lab scientists supporting therapeutic drug monitoring and antimicrobial stewardship.',
    topics: [
      { title: 'Pharmacokinetics', description: 'Absorption, distribution, metabolism and excretion.', body: 'Pharmacokinetics describes how a drug is absorbed, distributed, metabolised and excreted. Half-life, clearance and volume of distribution determine dosing intervals and steady-state levels. Therapeutic drug monitoring uses these principles to adjust doses.' },
      { title: 'Pharmacodynamics', description: 'Receptors, dose-response curves and drug interactions.', body: 'Pharmacodynamics describes what a drug does to the body, usually through binding to a receptor. Dose-response curves show potency and efficacy. Drug interactions can be additive, synergistic or antagonistic, which matters when combining treatments.' },
      { title: 'Antimicrobial Agents', description: 'Classes, mechanisms and susceptibility testing.', body: 'Antimicrobials act by inhibiting cell wall synthesis, protein synthesis, nucleic acid synthesis or metabolic pathways. Susceptibility testing reports whether an organism is susceptible, intermediate or resistant to a drug at defined breakpoints. Use local guidelines and the lab antibiogram when advising on empirical therapy.' },
      { title: 'Drug Safety and Adverse Reactions', description: 'Reporting, monitoring and recognising toxicity.', body: 'Adverse drug reactions range from predictable dose-related effects to rare idiosyncratic reactions. Laboratory monitoring for toxicity includes liver and renal function, full blood count and drug levels where available. Serious reactions should be reported through the national pharmacovigilance system.' },
    ],
  },
  {
    slug: 'public-health-epidemiology',
    title: 'Public Health & Epidemiology',
    level: 'Beginner',
    description: 'The core tools of epidemiology: measuring disease frequency, designing studies, running surveillance and investigating outbreaks. Also covers screening and diagnostic accuracy as they apply to laboratory testing. Written for lab scientists and public health staff working in surveillance and outbreak response.',
    topics: [
      { title: 'Measures of Disease Frequency', description: 'Prevalence, incidence, attack rate and mortality measures.', body: 'Prevalence measures how many people have a condition at a point in time, while incidence measures new cases over a period. Attack rate is used in outbreak investigations, and case fatality rate describes severity. Choosing the right measure depends on the question being asked.' },
      { title: 'Study Designs', description: 'Cohort, case-control, cross-sectional and trial designs.', body: 'Cohort studies follow exposed and unexposed people forward in time, and case-control studies compare cases and controls looking back at exposure. Cross-sectional studies capture prevalence at one point in time, and randomised trials give the strongest evidence for intervention effects. Each design has its own sources of bias.' },
      { title: 'Surveillance and Outbreak Investigation', description: 'Case definitions, epidemic curves and response steps.', body: 'Surveillance collects and analyses case data to detect and monitor disease, and a clear case definition is essential. An outbreak investigation confirms the diagnosis, describes cases by time, place and person, and tests hypotheses about the source. Results are used to guide control measures.' },
      { title: 'Screening and Diagnostic Accuracy', description: 'Sensitivity, specificity, predictive values and likelihood ratios.', body: 'Sensitivity is the proportion of true cases a test detects, and specificity is the proportion of non-cases it correctly rules out. Positive and negative predictive values depend on disease prevalence in the tested population. Lab scientists should understand how these measures change when a test is used in a different setting.' },
    ],
  },
  {
    slug: 'laboratory-management-ethics',
    title: 'Laboratory Management & Ethics',
    level: 'Beginner',
    description: 'The quality, safety and ethical framework that governs a working laboratory. Covers ISO 15189 quality management, biosafety and waste handling, informed consent and record keeping. Useful for lab scientists preparing for accreditation work or supervisory roles.',
    topics: [
      { title: 'Quality Management and ISO 15189', description: 'Document control, audits and continuous improvement.', body: 'ISO 15189 sets requirements for quality and competence in medical laboratories, covering documents, equipment, staff and processes. Document control, internal audits and corrective actions are central to maintaining accreditation. Continual improvement is driven by nonconformities and quality indicators.' },
      { title: 'Biosafety and Waste Handling', description: 'Risk assessment, PPE and safe disposal of clinical waste.', body: 'Biosafety starts with risk assessment and the correct use of PPE, safety cabinets and sharps containers. Clinical waste must be segregated, labelled and disposed of according to national regulations. Staff should know the spill and exposure procedures before they need them.' },
      { title: 'Laboratory Ethics and Informed Consent', description: 'Confidentiality, consent for testing and research ethics.', body: 'Laboratory staff handle sensitive patient information and must protect confidentiality. Informed consent is needed for certain tests, especially genetic and research testing, and for the use of samples. Ethics committee approval is required before using samples for research.' },
      { title: 'Inventory and Record Keeping', description: 'Reagent tracking, expiry control and traceable records.', body: 'Reagents and consumables need batch tracking, expiry checks and temperature monitoring. Records must be complete, legible and traceable to the person and time of each action. Good records are the basis of any investigation or audit.' },
    ],
  },
  {
    slug: 'research-methods-biostatistics',
    title: 'Research Methods & Biostatistics',
    level: 'Intermediate',
    description: 'Practical research skills for lab scientists: describing data, choosing and interpreting statistical tests, planning sample size and writing a protocol. Built around the questions you face in real laboratory and clinical research. Useful for students writing dissertations and professionals preparing studies.',
    topics: [
      { title: 'Descriptive Statistics', description: 'Mean, median, standard deviation and presenting data.', body: 'Descriptive statistics summarise data with measures of central tendency such as mean and median, and measures of spread such as standard deviation and interquartile range. The choice depends on the shape of the distribution. Graphs should show the spread of the data, not only the average.' },
      { title: 'Hypothesis Testing', description: 'Null hypothesis, p-values, confidence intervals and common tests.', body: 'A hypothesis test asks how likely the observed result is if the null hypothesis were true. The p-value is not the probability that the hypothesis is true, and a confidence interval shows the range of plausible effect sizes. Choose t-tests, chi-square tests or non-parametric tests according to the data type and distribution.' },
      { title: 'Sample Size and Study Design', description: 'Power, effect size and planning a study that can answer its question.', body: 'Sample size depends on the expected effect size, the variability of the outcome, the significance level and the desired power. An underpowered study can miss real effects and waste resources. Plan the sample size before data collection starts.' },
      { title: 'Writing a Research Protocol', description: 'Structure, ethics approval and a clear methods section.', body: 'A research protocol sets out the question, background, design, population, procedures, analysis plan and ethics. A clear methods section lets another scientist repeat the work. Submit the protocol for ethics review before any data or samples are collected.' },
    ],
  },
];

export const EXPANSION_COMMUNITIES = [
  { slug: 'parasitology-point', name: 'Parasitology Point', tag: 'Parasitology', description: 'Stool, blood film and tissue parasite identification. Share your slides, stain tips and tricky morphology.' },
  { slug: 'chemistry-corner', name: 'Chemistry Corner', tag: 'Chemistry', description: 'Analyser troubleshooting, QC charts, reference intervals and biochemistry questions from the bench.' },
  { slug: 'histopath-crew', name: 'Histopath Crew', tag: 'Histopathology', description: 'Processing, H&E staining, cytology smears and everything between the block and the slide.' },
  { slug: 'research-writing-lab', name: 'Research & Writing Lab', tag: 'Research', description: 'Protocols, statistics help, dissertation structure and getting papers through review.' },
  { slug: 'virology-serology-room', name: 'Virology & Serology Room', tag: 'Virology', description: 'PCR setup, ELISA troubleshooting, HIV and hepatitis testing questions and interpretation.' },
];
