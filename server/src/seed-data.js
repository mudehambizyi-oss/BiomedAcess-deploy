// Sample biomedical course content used by the seed script.
// Each subtopic gets one text "notes" resource generated from its `notes` field.

export const COURSES = [
  {
    slug: 'intro-human-anatomy',
    title: 'Intro to Human Anatomy',
    description: 'A structured tour of the human body: its organisation, skeletal and muscular systems, and the cardiovascular system. Built for first-year health and life sciences students.',
    level: 'Beginner',
    is_paid: 0,
    price_cents: 0,
    topics: [
      {
        title: 'Organisation of the Body',
        description: 'Levels of structural organisation and anatomical language.',
        subtopics: [
          {
            title: 'Anatomical position and directional terms',
            body: 'Anatomical position: standing upright, facing forward, arms at the sides, palms facing forward. Directional terms describe location relative to this position.',
            notes: `ANATOMICAL POSITION AND DIRECTIONAL TERMS (sample notes)

Anatomical position is the reference posture for all anatomical description: the body stands erect, face and palms forward, feet flat and parallel, arms at the sides.

Key directional terms
- Superior / inferior: toward the head / toward the feet.
- Anterior (ventral) / posterior (dorsal): front / back.
- Medial / lateral: toward the midline / away from the midline.
- Proximal / distal: closer to / farther from the point of attachment (used for limbs).
- Superficial / deep: closer to / farther from the body surface.

Planes of section
- Sagittal: divides body into left and right portions. A midsagittal plane splits it into equal halves.
- Frontal (coronal): divides into anterior and posterior portions.
- Transverse (horizontal): divides into superior and inferior portions.

Body cavities
- Dorsal cavity: cranial and vertebral cavities.
- Ventral cavity: thoracic (with mediastinum), and abdominopelvic cavities.

Study tip: practise describing the location of a structure in full sentences, e.g. "the heart lies superior to the diaphragm and anterior to the vertebral column".`,
          },
          {
            title: 'Levels of structural organisation',
            body: 'From chemical to organism level: atoms, molecules, organelles, cells, tissues, organs, organ systems, organism.',
            notes: `LEVELS OF STRUCTURAL ORGANISATION (sample notes)

The body is organised in a hierarchy:
1. Chemical level: atoms combine into molecules (for example, proteins, lipids, nucleic acids).
2. Cellular level: molecules form organelles and cells, the smallest living units.
3. Tissue level: groups of similar cells with a common function. The four primary tissue types are epithelial, connective, muscle and nervous tissue.
4. Organ level: two or more tissue types working together (for example, the stomach).
5. Organ system level: organs that cooperate on a common purpose (for example, the digestive system).
6. Organismal level: all organ systems together form the whole organism.

Clinical link: many diseases are understood by asking which level is affected. Atherosclerosis, for example, begins at the cellular and tissue level (endothelial injury, lipid deposition) and becomes an organ-level problem when it narrows coronary arteries.`,
          },
        ],
        quiz: {
          title: 'Quiz: Organisation of the Body',
          questions: [
            { prompt: 'Which term describes a location closer to the head?', options: ['Inferior', 'Superior', 'Distal', 'Lateral'], correct: 1, explanation: 'Superior means toward the head; inferior means toward the feet.' },
            { prompt: 'A sagittal section divides the body into which parts?', options: ['Superior and inferior', 'Anterior and posterior', 'Left and right', 'Medial and lateral'], correct: 2, explanation: 'Sagittal planes run front to back and separate left from right.' },
            { prompt: 'Which is the correct order from simplest to most complex?', options: ['Cell, tissue, organ, organ system', 'Tissue, cell, organ, organism', 'Organ, tissue, cell, molecule', 'Organ system, organ, tissue, cell'], correct: 0, explanation: 'Cells group into tissues, tissues into organs, and organs into organ systems.' },
            { prompt: 'How many primary tissue types are recognised in the body?', options: ['2', '3', '4', '6'], correct: 2, explanation: 'Epithelial, connective, muscle and nervous tissue.' },
          ],
        },
      },
      {
        title: 'Skeletal and Muscular Systems',
        description: 'Bone structure, joints and the principles of skeletal muscle action.',
        subtopics: [
          {
            title: 'Bone structure and classification',
            body: 'Compact and spongy bone, the periosteum, and the classification of bones by shape.',
            notes: `BONE STRUCTURE AND CLASSIFICATION (sample notes)

Gross structure
- Compact bone: dense outer layer; osteons (Haversian systems) run parallel to the long axis.
- Spongy (cancellous) bone: trabeculae enclosing red marrow in many adult bones.
- Periosteum: fibrous membrane covering the outer surface of bone; essential for growth, repair and blood supply.
- Endosteum: lines the medullary cavity.
- Medullary cavity: houses yellow marrow (fat) in adult long bones.

Classification by shape
- Long bones (femur, humerus): longer than wide.
- Short bones (carpals, tarsals): roughly cube shaped.
- Flat bones (skull vault, sternum, scapula): thin and broad.
- Irregular bones (vertebrae): complex shapes.

Bone cells
- Osteoblasts build bone matrix; osteocytes maintain it; osteoclasts resorb bone.

Clinical link: osteoporosis reflects an imbalance where osteoclast activity outpaces osteoblast activity, reducing bone density and increasing fracture risk.`,
          },
          {
            title: 'Joints and classification',
            body: 'Fibrous, cartilaginous and synovial joints, with examples of movement types.',
            notes: `JOINTS AND CLASSIFICATION (sample notes)

Joints are classified structurally and functionally.

Structural classes
- Fibrous joints: bones joined by dense connective tissue; little or no movement. Examples: sutures of the skull, the gomphosis of a tooth in its socket.
- Cartilaginous joints: bones joined by cartilage. Synchondroses (for example, the epiphyseal plate) and symphyses (for example, the pubic symphysis, intervertebral discs).
- Synovial joints: freely movable; contain a joint capsule, synovial fluid and articular cartilage. Examples: knee, shoulder, hip.

Functional classes
- Synarthrosis: immovable. Amphiarthrosis: slightly movable. Diarthrosis: freely movable (all synovial joints).

Synovial joint types by movement
- Hinge (elbow), pivot (atlantoaxial joint), ball-and-socket (hip, shoulder), saddle (thumb carpometacarpal), condyloid (wrist), plane (intercarpal).

Clinical link: the rotator cuff stabilises the shoulder, a ball-and-socket joint with a shallow socket, which makes it highly mobile but prone to dislocation.`,
          },
        ],
        quiz: {
          title: 'Quiz: Skeletal and Muscular Systems',
          questions: [
            { prompt: 'Which cell type breaks down bone tissue?', options: ['Osteoblast', 'Osteocyte', 'Osteoclast', 'Chondrocyte'], correct: 2, explanation: 'Osteoclasts resorb bone; osteoblasts build it.' },
            { prompt: 'The periosteum is best described as:', options: ['Lining of the marrow cavity', 'Fibrous membrane covering the outer bone surface', 'Cartilage at the joint surface', 'Layer of spongy bone'], correct: 1, explanation: 'The periosteum covers the outer bone; the endosteum lines the marrow cavity.' },
            { prompt: 'Which joint type is the knee?', options: ['Fibrous', 'Cartilaginous', 'Synovial', 'Synchondrosis'], correct: 2, explanation: 'The knee is a freely movable synovial joint.' },
            { prompt: 'The femur is an example of which bone class?', options: ['Flat', 'Short', 'Irregular', 'Long'], correct: 3, explanation: 'Long bones are longer than they are wide.' },
          ],
        },
      },
    ],
  },
  {
    slug: 'medical-microbiology',
    title: 'Medical Microbiology',
    description: 'Bacteria, viruses, fungi and parasites that cause human disease, with an emphasis on pathogenesis, diagnosis and antimicrobial principles.',
    level: 'Intermediate',
    is_paid: 0,
    price_cents: 0,
    topics: [
      {
        title: 'Bacterial Structure and Classification',
        description: 'Cell envelope, staining and the Gram stain.',
        subtopics: [
          {
            title: 'The bacterial cell envelope',
            body: 'Cell wall, peptidoglycan, outer membrane, capsule and flagella.',
            notes: `THE BACTERIAL CELL ENVELOPE (sample notes)

Key components
- Cell membrane: phospholipid bilayer; site of respiration and transport in bacteria.
- Peptidoglycan (murein) cell wall: polymer of N-acetylglucosamine and N-acetylmuramic acid with peptide cross-links. The target of penicillins and cephalosporins.
- Gram-positive walls: thick peptidoglycan layer, teichoic acids.
- Gram-negative walls: thin peptidoglycan plus an outer membrane containing lipopolysaccharide (LPS, endotoxin).
- Capsule: polysaccharide layer that resists phagocytosis; a major virulence factor (e.g. Streptococcus pneumoniae).
- Flagella, pili and fimbriae: motility and attachment.

Clinical link: because LPS is part of the outer membrane of Gram-negative bacteria, it is a major driver of septic shock.`,
          },
          {
            title: 'The Gram stain',
            body: 'Crystal violet, iodine, decolouriser and safranin: how Gram-positive and Gram-negative cells differ.',
            notes: `THE GRAM STAIN (sample notes)

Steps
1. Crystal violet (primary stain) is applied to all cells.
2. Gram's iodine is applied as a mordant, forming a crystal violet-iodine complex.
3. Decolouriser (ethanol or acetone) is applied briefly.
4. Safranin (counterstain) is applied last.

Result
- Gram-positive cells retain the crystal violet complex (thick peptidoglycan traps it) and appear purple.
- Gram-negative cells lose the complex in the decolouriser (the outer membrane is disrupted and the thin wall cannot retain it) and take up safranin, appearing pink or red.

Common mistakes
- Over-decolourising a Gram-positive culture can make it falsely appear Gram-negative.
- Old cultures can stain Gram-variable.

Study tip: remember "purple = peptidoglycan thick, pink = outer membrane".`,
          },
        ],
        quiz: {
          title: 'Quiz: Bacterial Structure and Classification',
          questions: [
            { prompt: 'Which Gram-negative component is responsible for endotoxin activity?', options: ['Teichoic acid', 'Lipopolysaccharide', 'Capsule polysaccharide', 'Flagellin'], correct: 1, explanation: 'Lipopolysaccharide (LPS) in the outer membrane is the endotoxin.' },
            { prompt: 'Penicillin acts on which bacterial structure?', options: ['Ribosome', 'Peptidoglycan cell wall', 'Cell membrane', 'DNA gyrase'], correct: 1, explanation: 'Penicillins inhibit cross-linking of peptidoglycan.' },
            { prompt: 'In the Gram stain, Gram-positive cells appear:', options: ['Pink', 'Colourless', 'Purple', 'Green'], correct: 2, explanation: 'They retain the crystal violet-iodine complex and stay purple.' },
            { prompt: 'Which feature is a major virulence factor that resists phagocytosis?', options: ['Pili', 'Capsule', 'Ribosomes', 'Plasmid'], correct: 1, explanation: 'Capsules are anti-phagocytic and a common virulence factor.' },
          ],
        },
      },
      {
        title: 'Viruses and Host Infection',
        description: 'Viral structure, replication cycle and the basics of pathogenesis.',
        subtopics: [
          {
            title: 'Viral structure and replication cycle',
            body: 'Capsid, envelope, genome types and the stages of viral replication.',
            notes: `VIRAL STRUCTURE AND REPLICATION (sample notes)

Structure
- Genome: DNA or RNA (single or double stranded, linear or segmented).
- Capsid: protein shell that protects the genome.
- Envelope: lipid membrane acquired from the host cell in some viruses (for example, influenza, HIV). Enveloped viruses are often more sensitive to detergents and drying.

Replication cycle (general)
1. Attachment: viral surface protein binds a host receptor.
2. Penetration / entry: membrane fusion or endocytosis.
3. Uncoating: release of the genome.
4. Replication and transcription: depends on genome type.
5. Assembly: new capsids and genomes are assembled.
6. Release: lysis (non-enveloped) or budding (enveloped).

Note: retroviruses such as HIV use reverse transcriptase to make DNA from their RNA genome, which integrates into the host genome.`,
          },
          {
            title: 'Viral pathogenesis and immunity',
            body: 'How viruses cause damage, and how innate and adaptive immunity respond.',
            notes: `VIRAL PATHOGENESIS AND IMMUNITY (sample notes)

Mechanisms of damage
- Direct cytopathic effect: lysis of infected cells or syncytia formation.
- Immune-mediated damage: cytotoxic T-cell killing of infected cells, or inflammatory responses.
- Oncogenesis: some viruses (for example, HPV) can drive uncontrolled cell growth.

Host defence
- Innate: interferons (type I) induce antiviral states in neighbouring cells; natural killer cells kill infected cells lacking MHC class I.
- Adaptive: neutralising antibodies block entry; CD8+ cytotoxic T cells eliminate infected cells; CD4+ helper cells coordinate the response.

Clinical link: vaccines work by priming neutralising antibodies and memory T cells without causing disease.`,
          },
        ],
        quiz: {
          title: 'Quiz: Viruses and Host Infection',
          questions: [
            { prompt: 'What enzyme allows HIV to convert its RNA genome into DNA?', options: ['DNA polymerase', 'Reverse transcriptase', 'Integrase', 'Helicase'], correct: 1, explanation: 'Retroviruses use reverse transcriptase.' },
            { prompt: 'Enveloped viruses typically exit the host cell by:', options: ['Lysis only', 'Budding', 'Crystallisation', 'Exocytosis of the capsid alone'], correct: 1, explanation: 'Enveloped viruses commonly bud through the host membrane.' },
            { prompt: 'Which immune cells kill virus-infected cells that display viral peptides on MHC class I?', options: ['CD4+ helper T cells', 'B cells', 'CD8+ cytotoxic T cells', 'Mast cells'], correct: 2, explanation: 'CD8+ T cells recognise antigen on MHC class I.' },
            { prompt: 'Type I interferons primarily function to:', options: ['Lyse bacteria directly', 'Induce an antiviral state in neighbouring cells', 'Produce antibodies', 'Break down peptidoglycan'], correct: 1, explanation: 'They warn and protect neighbouring cells against viral spread.' },
          ],
        },
      },
    ],
  },
  {
    slug: 'hematology-basics',
    title: 'Hematology Basics',
    description: 'Blood cells, haemopoiesis and the core principles of haematological testing. A paid course in this demo, to show the payment gate in action.',
    level: 'Intermediate',
    is_paid: 1,
    price_cents: 2900,
    topics: [
      {
        title: 'Blood Components and Haemopoiesis',
        description: 'Plasma, formed elements, and where blood cells come from.',
        subtopics: [
          {
            title: 'Composition of blood',
            body: 'Plasma proteins and the formed elements: erythrocytes, leukocytes and platelets.',
            notes: `COMPOSITION OF BLOOD (sample notes)

Blood is about 55% plasma and 45% formed elements (by volume, in typical adults, haematocrit around 45%).

Plasma
- About 90% water. Major proteins: albumin (oncotic pressure, transport), globulins (immunoglobulins among them), fibrinogen (clotting).

Formed elements
- Erythrocytes (red cells): anucleate, biconcave, carry haemoglobin. Lifespan about 120 days.
- Leukocytes (white cells): neutrophils, lymphocytes, monocytes, eosinophils, basophils.
- Platelets (thrombocytes): cell fragments from megakaryocytes; essential for primary haemostasis.

Clinical link: a full blood count (FBC) quantifies these elements and their indices (for example, MCV, MCH), giving first-line clues about anaemia, infection and bleeding disorders.`,
          },
          {
            title: 'Haemopoiesis',
            body: 'The haematopoietic stem cell and the lineages it produces.',
            notes: `HAEMOPOIESIS (sample notes)

All blood cells derive from haematopoietic stem cells (HSCs) in the bone marrow. HSCs are self-renewing and pluripotent.

Two main lineages
- Common myeloid progenitor: erythrocytes, megakaryocytes (platelets), granulocytes (neutrophils, eosinophils, basophils), monocytes (which become macrophages and dendritic cells).
- Common lymphoid progenitor: B cells, T cells, natural killer cells.

Key growth factors
- Erythropoietin (EPO), made by the kidney, drives red cell production.
- Thrombopoietin (TPO), mainly from the liver, drives platelet production.
- G-CSF stimulates neutrophil production.

Clinical link: anaemia of chronic kidney disease is often treated with erythropoiesis-stimulating agents because EPO production falls as kidney function declines.`,
          },
        ],
        quiz: {
          title: 'Quiz: Blood Components and Haemopoiesis',
          questions: [
            { prompt: 'Which hormone-like factor mainly stimulates red blood cell production?', options: ['Thrombopoietin', 'Erythropoietin', 'G-CSF', 'Insulin'], correct: 1, explanation: 'Erythropoietin, made mainly by the kidney, drives erythropoiesis.' },
            { prompt: 'Mature erythrocytes in humans are:', options: ['Nucleated and biconcave', 'Anucleate and biconcave', 'Anucleate and spherical', 'Nucleated and lobed'], correct: 1, explanation: 'Mature red cells lack a nucleus and have a biconcave shape.' },
            { prompt: 'Platelets are derived from which precursor cell?', options: ['Lymphoblast', 'Megakaryocyte', 'Erythroblast', 'Monoblast'], correct: 1, explanation: 'Platelets are fragments of megakaryocytes.' },
            { prompt: 'Which plasma protein is the main contributor to oncotic pressure?', options: ['Fibrinogen', 'Albumin', 'IgM', 'Thrombin'], correct: 1, explanation: 'Albumin is the principal plasma protein for oncotic pressure.' },
          ],
        },
      },
      {
        title: 'Anaemia and Red Cell Indices',
        description: 'Classification of anaemia and interpreting the red cell indices.',
        subtopics: [
          {
            title: 'Classifying anaemia by MCV',
            body: 'Microcytic, normocytic and macrocytic anaemias and their common causes.',
            notes: `CLASSIFYING ANAEMIA BY MCV (sample notes)

Mean corpuscular volume (MCV) groups anaemias:
- Microcytic (MCV below about 80 fL): iron deficiency, thalassaemia trait, anaemia of chronic disease (often normocytic early), sideroblastic anaemia.
- Normocytic (MCV about 80 to 100 fL): acute blood loss, anaemia of chronic disease, haemolysis, early iron or B12 deficiency, bone marrow failure.
- Macrocytic (MCV above about 100 fL): vitamin B12 or folate deficiency, alcohol, liver disease, myelodysplastic syndromes, certain drugs.

Practical approach
1. Confirm anaemia (haemoglobin below reference range for age and sex).
2. Classify by MCV.
3. Check reticulocyte count to assess marrow response.
4. Investigate the likely cause (iron studies, B12/folate, haemolysis markers).

Study tip: "Little (micro) iron, big (macro) B12 or folate."`,
          },
        ],
        quiz: {
          title: 'Quiz: Anaemia and Red Cell Indices',
          questions: [
            { prompt: 'Which MCV range is considered microcytic?', options: ['Below 80 fL', '80 to 100 fL', 'Above 100 fL', 'Above 120 fL'], correct: 0, explanation: 'Microcytic anaemia is an MCV below about 80 fL.' },
            { prompt: 'A macrocytic anaemia is most commonly associated with deficiency of:', options: ['Iron', 'Vitamin B12 or folate', 'Zinc', 'Vitamin C'], correct: 1, explanation: 'B12 and folate are required for DNA synthesis; deficiency leads to large red cells.' },
            { prompt: 'Which test best reflects the marrow response to anaemia?', options: ['Serum albumin', 'Reticulocyte count', 'Serum sodium', 'Blood glucose'], correct: 1, explanation: 'Reticulocytes indicate how actively the marrow is producing new red cells.' },
          ],
        },
      },
    ],
  },
];
