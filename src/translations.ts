export type Language = 'pt' | 'en' | 'es';

export const translations = {
  pt: {
    nav: {
      offers: "Ofertas",
      merchant: "Área da Empresa",
      admin: "Admin",
      howItWorks: "Como Funciona",
      appName: "Playas e Ventajas",
      login: "Entrar",
      logout: "Sair",
      scanner: "QR Scanner"
    },
    auth: {
      loginTitle: "Acesso da Empresa",
      registerTitle: "Cadastro da Empresa",
      forgotPassword: "Esqueceu sua senha?",
      resetPassword: "Redefinir Senha",
      email: "E-mail",
      password: "Senha",
      confirmPassword: "Confirmar Senha",
      companyName: "Nome da Empresa",
      cnpj: "CNPJ",
      loginBtn: "Entrar",
      registerBtn: "Cadastrar",
      resetBtn: "Enviar E-mail de Redefinição",
      noAccount: "Não tem conta? Cadastre-se",
      hasAccount: "Já tem conta? Entre",
      backToLogin: "Voltar ao Login",
      passwordsDoNotMatch: "As senhas não coincidem.",
      resetSent: "E-mail de redefinição enviado! Verifique sua caixa de entrada.",
      resetError: "Não foi possível enviar o e-mail. Tente novamente ou confira se o e-mail está correto.",
      resetUserNotFound: "Não encontramos uma conta com este e-mail.",
      authError: "Erro na autenticação. Verifique suas credenciais.",
      fillAll: "Preencha todos os campos."
    },
    home: {
      title: "Descubra as Melhores",
      subtitle: "Experiências na Praia",
      description: "Descontos exclusivos em coquetéis, aulas de surf e jantares de frutos do mar. Gere seu cupom instantaneamente e aproveite o paraíso.",
      validFrom: "Válido de:",
      validUntil: "Válido até:",
      clear: "Limpar",
      noOffers: "Nenhuma oferta encontrada para este período.",
      clearFilters: "Limpar filtros para ver todas as ofertas"
    },
    offerCard: {
      validUntil: "Válido até",
      getCoupon: "Pegar Cupom"
    },
    couponModal: {
      title: "Garanta seu cupom",
      description: "Digite seu e-mail para gerar um QR Code único para",
      emailLabel: "Endereço de E-mail",
      placeholder: "turista@exemplo.com",
      generateBtn: "Gerar QR Code",
      generating: "Gerando...",
      successTitle: "Cupom Gerado!",
      codeLabel: "Código do Cupom:",
      instruction: "Apresente este QR code ao comerciante para resgatar.",
      gamificationMsg: "Quanto mais cupons você usar, mais perto de benefícios exclusivos! Use sempre o mesmo e-mail para acumular vantagens.",
      emailQueuedHint: "Também registramos o envio de uma cópia por e-mail. Se não chegar, verifique spam e se a extensão de e-mail está configurada no Firebase (guia técnico).",
      emailNotQueuedHint: "O cupom acima é válido. O envio automático por e-mail não pôde ser enfileirado (rede ou regras do Firestore).",
      close: "Fechar",
      error: "Erro ao gerar cupom",
      soldOut: "Esta oferta esgotou os cupons disponíveis ou não está mais ativa."
    },
    admin: {
      title: "Gerenciar Ofertas",
      addOffer: "+ Adicionar Oferta",
      cancel: "Cancelar",
      save: "Salvar Oferta",
      tableOffer: "Oferta",
      tableMerchant: "Comerciante",
      tableActions: "Ações",
      placeholders: {
        title: "Título da Oferta",
        discount: "Desconto (ex: 20% OFF)",
        merchant: "Nome do Comerciante",
        desc: "Descrição",
        imageUrl: "URL da Imagem (opcional)",
        uploadImage: "Carregar Imagem (Max 2MB)",
        validFrom: "Válido de",
        validUntil: "Válido até",
        isActive: "Oferta Ativa",
        categories: "Categorias"
      },
      confirmDelete: "Tem certeza que deseja excluir esta oferta?",
      uploading: "Enviando imagem...",
      customersTitle: "Base de clientes e top consumidores",
      customersDesc:
        "E-mails que geraram cupom nas suas ofertas (dados da coleção de cupons no Firebase). Ordenados por quantidade de cupons; os 3 primeiros aparecem em destaque.",
      colEmail: "E-mail",
      colCoupons: "Cupons",
      colLast: "Último cupom",
      noCustomers: "Ainda não há cupons registrados para as suas ofertas, ou as ofertas antigas não tinham vínculo comercial. Novos cupons passam a contar a partir daqui.",
      maxCouponsLabel: "Máximo de cupons (QR) — opcional",
      maxCouponsPlaceholder: "Ex.: 50 (mínimo 5 se preencher)",
      maxCouponsHint: "Se preencher, ao atingir esse número a oferta fica inativa e some da página pública. Deixe vazio para sem limite.",
      maxCouponsInvalid: "O máximo de cupons deve ser um número inteiro maior ou igual a 5, ou deixe em branco."
    },
    categories: {
      bar: "Bar",
      restaurant: "Restaurante",
      experience: "Experiência",
      lodging: "Hospedagem",
      other: "Outros",
      all: "Todos"
    },
    merchant: {
      title: "Validar Cupom",
      tapToScan: "Toque para Escanear QR Code",
      or: "OU",
      enterCode: "Digite o Código Manualmente",
      check: "Verificar",
      cancelScan: "Cancelar Escaneamento",
      pointQr: "Aponte a câmera para o QR do cliente — a leitura é automática.",
      cameraError: "Não foi possível usar a câmera. Use HTTPS, permita o acesso ou digite o código manualmente.",
      valid: "Cupom Válido!",
      invalid: "Inválido",
      scanAnother: "Escanear Outro",
      backendError: "Validação no backend requer configuração completa.",
      notFound: "Cupom não encontrado.",
      alreadyUsed: "Cupom já utilizado.",
      wrongMerchant: "Este cupom não pertence às suas ofertas.",
      successMsg: "Cupom Validado com Sucesso!"
    },
    howItWorks: {
      title: "Como Funciona",
      description: "O Playas e Ventajas conecta você às melhores experiências da praia com descontos exclusivos. Veja como é simples aproveitar.",
      touristTitle: "Para Turistas",
      touristSteps: [
        "Navegue pelas ofertas filtrando por categorias (Bares, Restaurantes, etc) ou veja todas.",
        "Clique em \"Pegar Cupom\" e insira seu e-mail para gerar um QR Code único.",
        "Vá até o estabelecimento e apresente o QR Code na hora do pagamento.",
        "Aproveite seu desconto e a experiência!"
      ],
      merchantTitle: "Para Empresas",
      merchantSteps: [
        "Cadastre seu estabelecimento e faça login no Painel Admin.",
        "Crie ofertas atraentes: suba fotos reais, defina o desconto (ex: 10% OFF) e selecione a categoria.",
        "Gerencie a validade e ative/desative ofertas conforme seu estoque ou disponibilidade.",
        "Quando o cliente apresentar o QR Code, use o Scanner na área da empresa para validar."
      ]
    },
    legal: {
      termsTitle: "Termos de Uso",
      privacyTitle: "Política de Privacidade",
      termsBtn: "Termos de Uso",
      privacyBtn: "Política de Privacidade",
      understand: "Entendi",
      termsContent: [
        { title: "1. Aceitação dos Termos", text: "Ao acessar e usar o Playas e Ventajas, você concorda com estes termos. O serviço é fornecido \"como está\"." },
        { title: "2. Uso do Serviço", text: "O serviço conecta turistas a ofertas locais. Não nos responsabilizamos pela qualidade dos serviços prestados pelos estabelecimentos parceiros." },
        { title: "3. Cupons", text: "Os cupons são pessoais e intransferíveis. A validade e as regras de uso são determinadas pelo estabelecimento emissor." },
        { title: "4. Responsabilidades do Usuário", text: "O usuário é responsável pela veracidade das informações fornecidas e pelo uso adequado da plataforma." },
        { title: "5. Lei Aplicável", text: "Estes termos são regidos pelas leis da República Federativa do Brasil." }
      ],
      privacyContent: [
        { title: "1. Coleta de Dados", text: "Coletamos apenas o e-mail para geração do cupom. Esta coleta é realizada com base no legítimo interesse e na execução do contrato, conforme permitido pela LGPD (Lei nº 13.709/2018)." },
        { title: "2. Finalidade", text: "Seus dados são usados exclusivamente para a funcionalidade de geração, envio e validação de cupons de desconto." },
        { title: "3. Compartilhamento", text: "Não vendemos seus dados. O e-mail pode ser compartilhado com o estabelecimento parceiro apenas para fins de validação da oferta específica que você escolheu." },
        { title: "4. Seus Direitos", text: "Você pode solicitar a exclusão, correção ou acesso aos seus dados a qualquer momento entrando em contato conosco." },
        { title: "5. Segurança", text: "Adotamos medidas técnicas e administrativas para proteger seus dados pessoais contra acessos não autorizados." }
      ]
    },
    footer: {
      developedBy: "Desenvolvido por",
      rights: "© 2026 Playas e Ventajas. Todos os direitos reservados.",
      demoMode: "⚠ Modo Demo: Chaves Firebase não encontradas. Usando dados locais simulados."
    }
  },
  en: {
    nav: {
      offers: "Offers",
      merchant: "Merchant Area",
      admin: "Admin",
      howItWorks: "How It Works",
      appName: "Playas e Ventajas",
      login: "Login",
      logout: "Logout",
      scanner: "QR Scanner"
    },
    auth: {
      loginTitle: "Merchant Login",
      registerTitle: "Merchant Registration",
      forgotPassword: "Forgot Password?",
      resetPassword: "Reset Password",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      companyName: "Company Name",
      cnpj: "Tax ID (CNPJ)",
      loginBtn: "Login",
      registerBtn: "Register",
      resetBtn: "Send Reset Email",
      noAccount: "No account? Register",
      hasAccount: "Have an account? Login",
      backToLogin: "Back to Login",
      passwordsDoNotMatch: "Passwords do not match.",
      resetSent: "Reset email sent! Check your inbox.",
      resetError: "Could not send the email. Try again or check the address.",
      resetUserNotFound: "No account found with this email.",
      authError: "Authentication error. Check your credentials.",
      fillAll: "Please fill all fields."
    },
    home: {
      title: "Discover the Best",
      subtitle: "Beach Experiences",
      description: "Exclusive discounts on cocktails, surf lessons, and seafood dinners. Generate your coupon instantly and enjoy paradise.",
      validFrom: "Valid From:",
      validUntil: "Valid Until:",
      clear: "Clear",
      noOffers: "No offers found for this date range.",
      clearFilters: "Clear filters to see all offers"
    },
    offerCard: {
      validUntil: "Valid until",
      getCoupon: "Get Coupon"
    },
    couponModal: {
      title: "Get your coupon",
      description: "Enter your email to generate a unique QR code for",
      emailLabel: "Email Address",
      placeholder: "tourist@example.com",
      generateBtn: "Generate QR Code",
      generating: "Generating...",
      successTitle: "Coupon Generated!",
      codeLabel: "Coupon Code:",
      instruction: "Show this QR code to the merchant to redeem.",
      gamificationMsg: "The more coupons you use, the closer you are to exclusive benefits! Always use the same email to accumulate rewards.",
      emailQueuedHint: "We also queued a copy by email. If it doesn't arrive, check spam and whether the Firebase email extension is configured (technical guide).",
      emailNotQueuedHint: "Your coupon above is valid. Automatic email could not be queued (network or Firestore rules).",
      close: "Close",
      error: "Error generating coupon",
      soldOut: "This offer has no more coupons available or is no longer active."
    },
    admin: {
      title: "Manage Offers",
      addOffer: "+ Add Offer",
      cancel: "Cancel",
      save: "Save Offer",
      tableOffer: "Offer",
      tableMerchant: "Merchant",
      tableActions: "Actions",
      placeholders: {
        title: "Offer Title",
        discount: "Discount (e.g. 20% OFF)",
        merchant: "Merchant Name",
        desc: "Description",
        imageUrl: "Image URL (optional)",
        uploadImage: "Upload Image (Max 2MB)",
        validFrom: "Valid From",
        validUntil: "Valid Until",
        isActive: "Active Offer",
        categories: "Categories"
      },
      confirmDelete: "Are you sure you want to delete this offer?",
      uploading: "Uploading image...",
      customersTitle: "Customer base & top consumers",
      customersDesc:
        "Emails that generated coupons for your offers (from your coupons in Firebase). Sorted by coupon count; top 3 are highlighted.",
      colEmail: "Email",
      colCoupons: "Coupons",
      colLast: "Last coupon",
      noCustomers: "No coupons yet for your offers, or older offers lacked merchant linkage. New coupons count from here.",
      maxCouponsLabel: "Max coupons (QR) — optional",
      maxCouponsPlaceholder: "e.g. 50 (minimum 5 if set)",
      maxCouponsHint: "If set, when the limit is reached the offer becomes inactive and disappears from the public page. Leave empty for no limit.",
      maxCouponsInvalid: "Max coupons must be an integer ≥ 5, or leave blank."
    },
    categories: {
      bar: "Bar",
      restaurant: "Restaurant",
      experience: "Experience",
      lodging: "Lodging",
      other: "Other",
      all: "All"
    },
    merchant: {
      title: "Validate Coupon",
      tapToScan: "Tap to Scan QR Code",
      or: "OR",
      enterCode: "Enter Manual Code",
      check: "Check",
      cancelScan: "Cancel Scan",
      pointQr: "Point the camera at the customer's QR — reading is automatic.",
      cameraError: "Could not access the camera. Use HTTPS, allow access, or enter the code manually.",
      valid: "Valid Coupon!",
      invalid: "Invalid",
      scanAnother: "Scan Another",
      backendError: "Backend validation requires full setup.",
      notFound: "Coupon not found.",
      alreadyUsed: "Coupon already used.",
      wrongMerchant: "This coupon is not for your offers.",
      successMsg: "Coupon Validated Successfully!"
    },
    howItWorks: {
      title: "How It Works",
      description: "Playas e Ventajas connects you to the best beach experiences with exclusive discounts. See how simple it is to enjoy.",
      touristTitle: "For Tourists",
      touristSteps: [
        "Browse offers on the home page and choose the one you like best.",
        "Click \"Get Coupon\" and enter your email to generate a unique QR Code.",
        "Go to the establishment and present the QR Code at the time of payment.",
        "Enjoy your discount and the experience!"
      ],
      merchantTitle: "For Merchants",
      merchantSteps: [
        "Register your establishment and create attractive offers in the Admin Panel.",
        "When the customer presents the QR Code, access the \"Merchant\" area.",
        "Scan the code with your phone camera or enter the code manually.",
        "The system validates the coupon instantly and prevents fraud."
      ]
    },
    legal: {
      termsTitle: "Terms of Use",
      privacyTitle: "Privacy Policy",
      termsBtn: "Terms of Use",
      privacyBtn: "Privacy Policy",
      understand: "Understood",
      termsContent: [
        { title: "1. Acceptance of Terms", text: "By accessing and using Playas e Ventajas, you agree to these terms. The service is provided \"as is\"." },
        { title: "2. Use of Service", text: "The service connects tourists to local offers. We are not responsible for the quality of services provided by partner establishments." },
        { title: "3. Coupons", text: "Coupons are personal and non-transferable. Validity and usage rules are determined by the issuing establishment." },
        { title: "4. User Responsibilities", text: "The user is responsible for the accuracy of the information provided and for the proper use of the platform." },
        { title: "5. Applicable Law", text: "These terms are governed by the laws of the Federative Republic of Brazil." }
      ],
      privacyContent: [
        { title: "1. Data Collection", text: "We collect only email for coupon generation. This collection is performed based on legitimate interest and contract execution, as permitted by LGPD (Law No. 13.709/2018)." },
        { title: "2. Purpose", text: "Your data is used exclusively for the functionality of generating, sending, and validating discount coupons." },
        { title: "3. Sharing", text: "We do not sell your data. Email may be shared with the partner establishment only for validation purposes of the specific offer you chose." },
        { title: "4. Your Rights", text: "You can request deletion, correction, or access to your data at any time by contacting us." },
        { title: "5. Security", text: "We adopt technical and administrative measures to protect your personal data against unauthorized access." }
      ]
    },
    footer: {
      developedBy: "Developed by",
      rights: "© 2026 Playas e Ventajas. All rights reserved.",
      demoMode: "⚠ Demo Mode: Firebase keys not found. Using local mock data."
    }
  },
  es: {
    nav: {
      offers: "Ofertas",
      merchant: "Área de Empresa",
      admin: "Admin",
      howItWorks: "Cómo Funciona",
      appName: "Playas e Ventajas",
      login: "Ingresar",
      logout: "Salir",
      scanner: "Escáner QR"
    },
    auth: {
      loginTitle: "Acceso Empresa",
      registerTitle: "Registro de Empresa",
      forgotPassword: "¿Olvidaste tu contraseña?",
      resetPassword: "Restablecer Contraseña",
      email: "Correo Electrónico",
      password: "Contraseña",
      confirmPassword: "Confirmar Contraseña",
      companyName: "Nombre de la Empresa",
      cnpj: "RUC/NIT (CNPJ)",
      loginBtn: "Ingresar",
      registerBtn: "Registrarse",
      resetBtn: "Enviar Correo de Restablecimiento",
      noAccount: "¿No tienes cuenta? Regístrate",
      hasAccount: "¿Ya tienes cuenta? Ingresa",
      backToLogin: "Volver al Login",
      passwordsDoNotMatch: "Las contraseñas no coinciden.",
      resetSent: "¡Correo de restablecimiento enviado! Revisa tu bandeja.",
      resetError: "No se pudo enviar el correo. Inténtalo de nuevo o revisa la dirección.",
      resetUserNotFound: "No encontramos una cuenta con este correo.",
      authError: "Error de autenticación. Verifica tus credenciales.",
      fillAll: "Por favor completa todos los campos."
    },
    home: {
      title: "Descubre las Mejores",
      subtitle: "Experiencias de Playa",
      description: "Descuentos exclusivos en cócteles, clases de surf y cenas de mariscos. Genera tu cupón al instante y disfruta del paraíso.",
      validFrom: "Válido desde:",
      validUntil: "Válido hasta:",
      clear: "Limpiar",
      noOffers: "No se encontraron ofertas para este período.",
      clearFilters: "Limpiar filtros para ver todas las ofertas"
    },
    offerCard: {
      validUntil: "Válido hasta",
      getCoupon: "Obtener Cupón"
    },
    couponModal: {
      title: "Obtén tu cupón",
      description: "Ingresa tu correo electrónico para generar un código QR único para",
      emailLabel: "Dirección de Correo Electrónico",
      placeholder: "turista@ejemplo.com",
      generateBtn: "Generar Código QR",
      generating: "Generando...",
      successTitle: "¡Cupón Generado!",
      codeLabel: "Código del Cupón:",
      instruction: "Muestra este código QR al comerciante para canjearlo.",
      gamificationMsg: "¡Cuántos más cupones uses, más cerca estarás de beneficios exclusivos! Usa siempre el mismo correo para acumular ventajas.",
      emailQueuedHint: "También registramos el envío de una copia por correo. Si no llega, revisa spam y si la extensión de correo está configurada en Firebase (guía técnica).",
      emailNotQueuedHint: "El cupón de arriba es válido. El envío automático por correo no pudo ponerse en cola (red o reglas de Firestore).",
      close: "Cerrar",
      error: "Error al generar el cupón",
      soldOut: "Esta oferta agotó los cupones disponibles o ya no está activa."
    },
    admin: {
      title: "Gestionar Ofertas",
      addOffer: "+ Agregar Oferta",
      cancel: "Cancelar",
      save: "Guardar Oferta",
      tableOffer: "Oferta",
      tableMerchant: "Comerciante",
      tableActions: "Acciones",
      placeholders: {
        title: "Título de la Oferta",
        discount: "Descuento (ej: 20% OFF)",
        merchant: "Nombre del Comerciante",
        desc: "Descripción",
        imageUrl: "URL de la Imagen (opcional)",
        uploadImage: "Subir Imagen (Max 2MB)",
        validFrom: "Válido desde",
        validUntil: "Válido hasta",
        isActive: "Oferta Activa",
        categories: "Categorías"
      },
      confirmDelete: "¿Estás seguro de que deseas eliminar esta oferta?",
      uploading: "Subiendo imagen...",
      customersTitle: "Base de clientes y consumidores top",
      customersDesc:
        "Correos que generaron cupones en tus ofertas (datos en Firebase). Ordenados por cantidad de cupones; los 3 primeros destacan.",
      colEmail: "Correo",
      colCoupons: "Cupones",
      colLast: "Último cupón",
      noCustomers: "Aún no hay cupones para tus ofertas, o las ofertas antiguas no tenían vínculo. Los nuevos cupones cuentan desde ahora.",
      maxCouponsLabel: "Máximo de cupones (QR) — opcional",
      maxCouponsPlaceholder: "Ej.: 50 (mínimo 5 si completas)",
      maxCouponsHint: "Si lo completas, al llegar a ese número la oferta queda inactiva y desaparece de la página pública. Vacío = sin límite.",
      maxCouponsInvalid: "El máximo debe ser un entero ≥ 5, o déjalo en blanco."
    },
    categories: {
      bar: "Bar",
      restaurant: "Restaurante",
      experience: "Experiencia",
      lodging: "Alojamiento",
      other: "Otros",
      all: "Todos"
    },
    merchant: {
      title: "Validar Cupón",
      tapToScan: "Toca para Escanear QR",
      or: "O",
      enterCode: "Ingresar Código Manualmente",
      check: "Verificar",
      cancelScan: "Cancelar Escaneo",
      pointQr: "Apunta la cámara al QR del cliente — la lectura es automática.",
      cameraError: "No se pudo usar la cámara. Usa HTTPS, permite el acceso o ingresa el código manualmente.",
      valid: "¡Cupón Válido!",
      invalid: "Inválido",
      scanAnother: "Escanear Otro",
      backendError: "La validación en el backend requiere configuración completa.",
      notFound: "Cupón no encontrado.",
      alreadyUsed: "Cupón ya utilizado.",
      wrongMerchant: "Este cupón no corresponde a tus ofertas.",
      successMsg: "¡Cupón Validado Exitosamente!"
    },
    howItWorks: {
      title: "Cómo Funciona",
      description: "Playas e Ventajas te conecta con las mejores experiencias de playa con descuentos exclusivos. Mira qué simple es disfrutar.",
      touristTitle: "Para Turistas",
      touristSteps: [
        "Navega por las ofertas en la página de inicio y elige la que más te guste.",
        "Haz clic en \"Obtener Cupón\" e ingresa tu correo para generar un código QR único.",
        "Ve al establecimiento y presenta el código QR al momento de pagar.",
        "¡Disfruta de tu descuento y la experiencia!"
      ],
      merchantTitle: "Para Empresas",
      merchantSteps: [
        "Registra tu establecimiento y crea ofertas atractivas en el Panel de Admin.",
        "Cuando el cliente presente el código QR, accede al área \"Comerciante\".",
        "Escanea el código con la cámara de tu celular o ingresa el código manualmente.",
        "El sistema valida el cupón al instante y evita fraudes."
      ]
    },
    legal: {
      termsTitle: "Términos de Uso",
      privacyTitle: "Política de Privacidad",
      termsBtn: "Términos de Uso",
      privacyBtn: "Política de Privacidad",
      understand: "Entendido",
      termsContent: [
        { title: "1. Aceptación de los Términos", text: "Al acceder y utilizar Playas e Ventajas, aceptas estos términos. El servicio se proporciona \"tal cual\"." },
        { title: "2. Uso del Servicio", text: "El servicio conecta a turistas con ofertas locales. No somos responsables de la calidad de los servicios prestados por los establecimientos asociados." },
        { title: "3. Cupones", text: "Los cupones son personales e intransferibles. La validez y las reglas de uso son determinadas por el establecimiento emisor." },
        { title: "4. Responsabilidades del Usuario", text: "El usuario es responsable de la veracidad de la información proporcionada y del uso adecuado de la plataforma." },
        { title: "5. Ley Aplicable", text: "Estos términos se rigen por las leyes de la República Federativa de Brasil." }
      ],
      privacyContent: [
        { title: "1. Recolección de Datos", text: "Recopilamos solo el correo electrónico para la generación del cupón. Esta recolección se realiza con base en el interés legítimo y la ejecución del contrato, según lo permitido por la LGPD (Ley Nº 13.709/2018)." },
        { title: "2. Finalidad", text: "Tus datos se utilizan exclusivamente para la funcionalidad de generación, envío y validación de cupones de descuento." },
        { title: "3. Compartir", text: "No vendemos tus datos. El correo electrónico puede ser compartido con el establecimiento asociado solo para fines de validación de la oferta específica que elegiste." },
        { title: "4. Tus Derechos", text: "Puedes solicitar la eliminación, corrección o acceso a tus datos en cualquier momento contactándonos." },
        { title: "5. Seguridad", text: "Adoptamos medidas técnicas y administrativas para proteger tus datos personales contra accesos no autorizados." }
      ]
    },
    footer: {
      developedBy: "Desarrollado por",
      rights: "© 2026 Playas e Ventajas. Todos los derechos reservados.",
      demoMode: "⚠ Modo Demo: Claves de Firebase no encontradas. Usando datos simulados locales."
    }
  }
};
