USE [Dreamsoft_UAT]
GO
/****** Object:  Table [dbo].[App_Accounts]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Accounts](
	[AccountId] [bigint] IDENTITY(1,1) NOT NULL,
	[BusinessUnitId] [bigint] NULL,
	[BranchId] [bigint] NULL,
	[AccountGroupId] [bigint] NOT NULL,
	[AccountCode] [nvarchar](50) NULL,
	[RefAccountCode] [nvarchar](50) NULL,
	[AccountType] [nvarchar](5) NULL,
	[AccountRegType] [nvarchar](5) NULL,
	[AccountName] [nvarchar](100) NULL,
	[AccountAlias] [nvarchar](200) NULL,
	[AccountDetails] [nvarchar](500) NULL,
	[AccountCategoryId] [bigint] NULL,
	[AccountCategoryIds] [nvarchar](1000) NULL,
	[AccountAllianceId] [bigint] NULL,
	[CreditLimit] [money] NULL,
	[CreditDay] [smallint] NULL,
	[CreditPer] [numeric](12, 2) NULL,
	[Detail1] [nvarchar](100) NULL,
	[Detail2] [nvarchar](100) NULL,
	[Detail3] [nvarchar](100) NULL,
	[Detail4] [nvarchar](100) NULL,
	[Detail5] [nvarchar](100) NULL,
	[Detail6] [nvarchar](100) NULL,
	[Detail7] [nvarchar](100) NULL,
	[Detail8] [nvarchar](100) NULL,
	[Detail9] [nvarchar](100) NULL,
	[Detail10] [nvarchar](100) NULL,
	[Detail11] [nvarchar](100) NULL,
	[Detail12] [nvarchar](100) NULL,
	[BankName] [nvarchar](100) NULL,
	[BankAcNo] [nvarchar](50) NULL,
	[BankSwift] [nvarchar](50) NULL,
	[BankIFSCCode] [nvarchar](50) NULL,
	[AccountAddress] [nvarchar](255) NULL,
	[GeographicalId] [bigint] NULL,
	[BookId] [bigint] NULL,
	[Pincode] [nvarchar](100) NULL,
	[PincodeId] [bigint] NULL,
	[GeographicalName] [nvarchar](100) NULL,
	[AccountPhone] [nvarchar](100) NULL,
	[AccountMobile] [nvarchar](100) NULL,
	[AccountMobile_Alt] [nvarchar](100) NULL,
	[AccountAddress_PR] [nvarchar](255) NULL,
	[Pincode_PR] [nvarchar](50) NULL,
	[PincodeId_PR] [bigint] NULL,
	[GeographicalId_PR] [bigint] NULL,
	[GeographicalName_PR] [nvarchar](100) NULL,
	[Alt_EmailId] [nvarchar](100) NULL,
	[AccountEmail] [nvarchar](100) NULL,
	[AccountPassword] [nvarchar](500) NULL,
	[AccountWeb] [nvarchar](50) NULL,
	[TaxMasterId] [bigint] NULL,
	[MessageType] [tinyint] NULL,
	[MessagePrompt] [nvarchar](200) NULL,
	[RegistrationDate] [datetime] NULL,
	[LedgerType] [tinyint] NULL,
	[CreditPrompt] [tinyint] NULL,
	[DOB] [datetime] NULL,
	[PlaceOfBirth] [nvarchar](100) NULL,
	[Nationality] [nvarchar](50) NULL,
	[BankBranchName] [nvarchar](100) NULL,
	[MicrCode] [nvarchar](50) NULL,
	[RollTypeIds] [nvarchar](50) NULL,
	[RecordStatus] [tinyint] NULL,
	[EntityType] [nvarchar](10) NULL,
	[ApplicationStatus] [tinyint] NULL,
	[OverseasSocietyName] [nvarchar](150) NULL,
	[AssociationName_India] [nvarchar](150) NULL,
	[ReUpdateInfo] [nvarchar](100) NULL,
	[TDSRate] [real] NULL,
	[TDSAccountId] [bigint] NULL,
	[KindAttention1] [nvarchar](100) NULL,
	[KindAttention2] [nvarchar](100) NULL,
	[AccountImage] [nvarchar](100) NULL,
	[FileRefNo] [nvarchar](50) NULL,
	[FatherName] [nvarchar](100) NULL,
	[FirstName] [nvarchar](30) NULL,
	[LastName] [nvarchar](45) NULL,
	[Gender] [nvarchar](11) NULL,
	[PreferredLanguage] [nvarchar](100) NULL,
	[PreferredLanguageId] [bigint] NULL,
	[SystemType] [nvarchar](1) NULL,
	[BillingType] [tinyint] NULL,
	[DeviceId_RowId] [nvarchar](50) NULL,
	[CreateDate] [datetime] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[ModifedBy] [nvarchar](100) NULL,
	[ModifedDate] [datetime] NULL,
	[AdmissionStatus] [tinyint] NULL,
	[AdmissionDate] [datetime] NULL,
	[AdmissionBy] [nvarchar](100) NULL,
	[AdmissionRemark] [nvarchar](1000) NULL,
	[DateOfDeath] [datetime] NULL,
	[DeathCertificateNo] [nvarchar](100) NULL,
	[Relationship] [nvarchar](50) NULL,
	[Currency_Id] [bigint] NULL,
	[CurrencyName] [nvarchar](50) NULL,
	[LanguageId] [bigint] NULL,
	[LanguageName] [nvarchar](100) NULL,
	[InternalIdentificationName] [nvarchar](50) NULL,
	[IPINumber] [nvarchar](100) NULL,
	[ChanlDesc] [nvarchar](max) NULL,
	[SocialSecurityNo] [nvarchar](100) NULL,
	[TRCNo] [nvarchar](100) NULL,
	[TenFform] [nvarchar](100) NULL,
	[DualNationality] [tinyint] NULL,
	[PreCountryId] [bigint] NULL,
	[PreCountryName] [nvarchar](100) NULL,
	[PreState] [nvarchar](100) NULL,
	[PreCity] [nvarchar](100) NULL,
	[PreZipCode] [nvarchar](50) NULL,
	[PerCountryId] [bigint] NULL,
	[PerCountryName] [nvarchar](100) NULL,
	[PerState] [nvarchar](100) NULL,
	[PerCity] [nvarchar](100) NULL,
	[PerZipCode] [nvarchar](50) NULL,
	[TeritoryAppFor] [nvarchar](100) NULL,
	[MemberRegistrationDate] [datetime] NULL,
	[SocietyId] [bigint] NULL,
	[BankAccountName] [varchar](100) NULL,
	[Consent] [tinyint] NULL,
	[PublicIP] [nvarchar](50) NULL,
	[Macid] [nvarchar](50) NULL,
	[GUID] [nvarchar](50) NULL,
	[ConsentDate] [datetime] NULL,
	[misasiaMemIntNo] [nvarchar](50) NULL,
	[requestId] [bigint] NULL,
	[requestDate] [datetime] NULL,
	[ResponseRemark] [nvarchar](max) NULL,
	[misasiaStaus] [tinyint] NOT NULL,
 CONSTRAINT [PK_AccountMaster] PRIMARY KEY CLUSTERED 
(
	[AccountId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_Accounts_Doc]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Accounts_Doc](
	[AccountDocId] [bigint] IDENTITY(1,1) NOT NULL,
	[AccountId] [bigint] NULL,
	[DocumentLookupId] [bigint] NULL,
	[ApprovalType] [nvarchar](5) NULL,
	[DocumentName] [nvarchar](500) NULL,
	[DocStatus] [tinyint] NULL,
	[DocumentCaption] [nvarchar](100) NULL,
	[DocFileName] [nvarchar](100) NULL,
	[DocUploadDesc] [nvarchar](100) NULL,
	[CreateDate] [datetime] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[ModifedBy] [nvarchar](100) NULL,
	[ModifedDate] [datetime] NULL,
 CONSTRAINT [PK_App_Accounts_Doc] PRIMARY KEY CLUSTERED 
(
	[AccountDocId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_Accounts_Temp]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Accounts_Temp](
	[TempAccountId] [bigint] IDENTITY(1,1) NOT NULL,
	[AccountName] [nvarchar](100) NULL,
	[AccountType] [nvarchar](5) NULL,
	[AccountRegType] [nvarchar](5) NULL,
	[AccountRegDate] [datetime] NULL,
	[AccountAlias] [nvarchar](200) NULL,
	[AccountAddress] [nvarchar](255) NULL,
	[GeographicalId] [bigint] NULL,
	[GeographicalName] [nvarchar](200) NULL,
	[BookId] [bigint] NULL,
	[Pincode] [nvarchar](100) NULL,
	[PincodeId] [bigint] NULL,
	[Alt_EmailId] [nvarchar](100) NULL,
	[Mobile] [nvarchar](50) NULL,
	[Telephone] [nvarchar](50) NULL,
	[AccoutnLogin] [nvarchar](100) NULL,
	[AccountPassword] [nvarchar](100) NULL,
	[AccountWeb] [nvarchar](100) NULL,
	[AadharNo] [nvarchar](20) NULL,
	[PanNo] [nvarchar](10) NULL,
	[TANNo] [nvarchar](10) NULL,
	[TINNo] [nvarchar](10) NULL,
	[GSTNo] [nvarchar](15) NULL,
	[CINNo] [nvarchar](50) NULL,
	[TDSRate] [tinyint] NULL,
	[TDSAccountId] [bigint] NULL,
	[RollTypeIds] [nvarchar](50) NULL,
	[CompanyName] [nvarchar](100) NULL,
	[KindAttention1] [nvarchar](100) NULL,
	[KindAttention2] [nvarchar](100) NULL,
	[CreateDate] [datetime] NULL,
	[AccountCode] [nvarchar](50) NULL,
	[RelationShip] [nvarchar](50) NULL,
	[Consent] [tinyint] NULL,
	[PublicIP] [nvarchar](50) NULL,
	[Macid] [nvarchar](50) NULL,
	[ConsentDate] [datetime] NULL
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_Accounts_WorkRegistration]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Accounts_WorkRegistration](
	[WorkNotificationId] [bigint] IDENTITY(1,1) NOT NULL,
	[AccountId] [bigint] NULL,
	[SongName] [nvarchar](100) NULL,
	[Film_AlbumName] [nvarchar](100) NULL,
	[LanguageNames] [nvarchar](100) NULL,
	[WorkCategory] [nvarchar](100) NULL,
	[Artist_Singers] [nvarchar](500) NULL,
	[Author_Composer] [nvarchar](100) NULL,
	[Publisher] [nvarchar](100) NULL,
	[Author_Lyricist] [nvarchar](100) NULL,
	[DigitalLink] [nvarchar](500) NULL,
	[DocLink] [nvarchar](100) NULL,
	[ReleaseYear] [bigint] NULL,
	[CreateDate] [datetime] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[ModifedBy] [nvarchar](100) NULL,
	[ModifedDate] [datetime] NULL,
 CONSTRAINT [PK_App_Accounts_WorkNotification] PRIMARY KEY CLUSTERED 
(
	[WorkNotificationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_BookMain]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_BookMain](
	[BookType] [nvarchar](50) NOT NULL,
	[BookName] [nvarchar](50) NOT NULL,
	[IsBookPost] [tinyint] NOT NULL,
	[StockEffect] [nvarchar](1) NOT NULL,
	[Status] [tinyint] NOT NULL,
	[BookTable] [nvarchar](50) NULL,
	[BookKey] [nvarchar](50) NULL,
	[BookModule] [nvarchar](3) NULL,
	[LastTransactionDate] [datetime] NULL,
 CONSTRAINT [PK_BookMain] PRIMARY KEY CLUSTERED 
(
	[BookType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_BookMaster]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_BookMaster](
	[BookID] [bigint] NOT NULL,
	[BusinessUnitId] [bigint] NULL,
	[BranchId] [bigint] NULL,
	[BookType] [nvarchar](2) NULL,
	[BookCode] [nvarchar](10) NULL,
	[BookPrefix] [nvarchar](10) NULL,
	[BookSrNo] [smallint] NULL,
	[BookGroup] [nvarchar](50) NULL,
	[BookName] [nvarchar](100) NULL,
	[BookAlias] [nvarchar](100) NULL,
	[TDSAccountId] [nvarchar](100) NULL,
	[AuthorizationLevel] [tinyint] NULL,
	[ReAuthorizationLevel] [tinyint] NULL,
	[AdvAuthorizationLevel] [tinyint] NULL,
	[DiscAuthorizationLevel] [tinyint] NULL,
	[GeographicalIds] [nvarchar](200) NULL,
	[EmailId] [nvarchar](250) NULL,
	[StockEffect] [nvarchar](1) NULL,
	[AccountEffect] [nvarchar](2) NULL,
	[AccountId] [bigint] NULL,
	[RoundUpId] [bigint] NULL,
	[PostingId] [bigint] NULL,
	[BankId] [bigint] NULL,
	[BookDescription] [nvarchar](255) NULL,
	[BookStatus] [tinyint] NULL,
	[FixedBook] [tinyint] NULL,
	[QCRequired] [tinyint] NULL,
	[NoBilling] [tinyint] NULL,
	[NoInventory] [tinyint] NULL,
	[BookCondition] [nvarchar](1000) NULL,
	[PrefixMain] [nvarchar](1) NULL,
	[PrefixSub] [nvarchar](1) NULL,
	[PrefixFixed] [nvarchar](8) NULL,
	[PrefixSerial] [nvarchar](1) NULL,
	[PrefixPrint] [nvarchar](5) NULL,
	[IsTaxable] [tinyint] NULL,
	[ProductGroups] [nvarchar](4000) NULL,
	[AccountCategoryIds] [nvarchar](4000) NULL,
	[ProductCategoryIds] [nvarchar](4000) NULL,
	[ProductOnlineCategoryIds] [nvarchar](4000) NULL,
	[StoreLocationIds] [nvarchar](4000) NULL,
	[DepartmentIds] [nvarchar](4000) NULL,
	[TaxMasterIds] [nvarchar](4000) NULL,
	[CurrencyId] [bigint] NULL,
	[TermsConditionIds] [nvarchar](4000) NULL,
	[LetterDraftIds] [nvarchar](4000) NULL,
	[ParentBookIds] [nvarchar](4000) NULL,
	[ReportIds] [nvarchar](4000) NULL,
	[UserIds] [nvarchar](4000) NULL,
	[WorkGroupIds] [nvarchar](4000) NULL,
	[ParentBookType] [nvarchar](2) NULL,
	[ApprovalLevel] [tinyint] NULL,
	[Approval1UserId] [bigint] NULL,
	[Approval2UserId] [bigint] NULL,
	[DisplayRate] [tinyint] NULL,
	[MessageType] [tinyint] NULL,
	[MessagePrompt] [nvarchar](200) NULL,
	[NoTaxDuties] [tinyint] NULL,
	[NoTermsCondition] [tinyint] NULL,
	[NoPaymentSchedule] [tinyint] NULL,
	[NoReturnable] [tinyint] NULL,
	[ParentBookRestrict] [tinyint] NULL,
	[CopyAttachment] [tinyint] NULL,
	[PlanFormula] [nvarchar](500) NULL,
	[LockRate] [tinyint] NULL,
	[InstantEmail] [tinyint] NULL,
	[OnlyAccounting] [tinyint] NULL,
	[CreditCardId] [bigint] NULL,
	[CouponId] [bigint] NULL,
	[ContactUs] [nvarchar](1000) NULL,
	[InstantPrint] [tinyint] NULL,
	[ChangeAccount] [tinyint] NULL,
	[ProcessCheckList] [tinyint] NULL,
	[ProductACPost] [tinyint] NULL,
	[RecursivePlan] [smallint] NULL,
	[TaxChargeLevel] [tinyint] NULL,
	[StockValidate] [tinyint] NULL,
	[PaymentReceipt] [nvarchar](1) NULL,
	[DisplayVenue] [nvarchar](1) NULL,
	[DisplaySong] [nvarchar](1) NULL,
	[AuthorisedSignatoryUserId] [bigint] NULL,
	[AuthorisedSignatoryUser] [nvarchar](100) NULL,
	[CreateDate] [datetime] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[ModifedBy] [nvarchar](100) NULL,
	[ModifedDate] [datetime] NULL,
 CONSTRAINT [PK_BookMaster] PRIMARY KEY CLUSTERED 
(
	[BookID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_EmailSMSSchedule]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_EmailSMSSchedule](
	[EmailSMSScheduleId] [bigint] IDENTITY(1,1) NOT NULL,
	[BusinessUnitIds] [nvarchar](1000) NULL,
	[BranchIds] [nvarchar](1000) NULL,
	[BookType] [nvarchar](50) NULL,
	[EmailType] [nvarchar](10) NULL,
	[DocumentNo] [nvarchar](50) NULL,
	[DocumentId] [bigint] NULL,
	[EmailSMSConfigId] [bigint] NULL,
	[EmailSMSDate] [datetime] NOT NULL,
	[ConfigurationType] [tinyint] NULL,
	[ReportType] [tinyint] NULL,
	[EmailSMTPId] [bigint] NULL,
	[EmailFromAddress] [nvarchar](1000) NULL,
	[EmailToAddress] [nvarchar](4000) NULL,
	[EmailCCAddress] [nvarchar](4000) NULL,
	[EmailBCCAddress] [nvarchar](4000) NULL,
	[EmailSubject] [nvarchar](1000) NULL,
	[EmailStartLine] [nvarchar](1000) NULL,
	[EmailContent] [ntext] NULL,
	[EmailSignature] [ntext] NULL,
	[EmailAttach] [nvarchar](1000) NULL,
	[DocumentAttach] [nvarchar](1000) NULL,
	[EmailReportValue] [nvarchar](4000) NULL,
	[ReportParameterName] [nvarchar](4000) NULL,
	[ReportParameterValue] [nvarchar](4000) NULL,
	[FromDate] [datetime] NULL,
	[ToDate] [datetime] NULL,
	[EmailSMSId] [bigint] NULL,
	[SMSTo] [nvarchar](250) NULL,
	[SMSURL] [nvarchar](4000) NULL,
	[EmailSMSScheduleStatus] [tinyint] NULL,
	[EmailSMSScheduleStatusRemark] [nvarchar](4000) NULL,
	[LetterDraft1] [ntext] NULL,
	[LetterDraft2] [ntext] NULL,
	[LetterDraft3] [ntext] NULL,
 CONSTRAINT [PK_EmailSMSSchedule] PRIMARY KEY CLUSTERED 
(
	[EmailSMSScheduleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_Geographical]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Geographical](
	[GeographicalId] [bigint] IDENTITY(1,1) NOT NULL,
	[GeographicalLevel] [tinyint] NULL,
	[GroupId] [bigint] NULL,
	[GeographicalName] [nvarchar](100) NULL,
	[GeographicalCode] [nvarchar](10) NULL,
	[GeographicalDetails] [nvarchar](255) NULL,
	[GeographicalCatTypeId] [bigint] NULL,
	[GeographicalTypeId] [bigint] NULL,
	[RecordStatus] [tinyint] NULL,
	[UserIds] [nvarchar](max) NULL,
	[CreateDate] [datetime] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[ModifedBy] [nvarchar](100) NULL,
	[ModifedDate] [datetime] NULL,
	[RMSCODE] [nvarchar](50) NULL,
 CONSTRAINT [PK_App_Geogrphical] PRIMARY KEY CLUSTERED 
(
	[GeographicalId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[App_Society]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[App_Society](
	[SocietyId] [bigint] IDENTITY(1,1) NOT NULL,
	[SocietyName] [nvarchar](50) NULL,
 CONSTRAINT [PK_App_Society] PRIMARY KEY CLUSTERED 
(
	[SocietyId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Doc_LookUp]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Doc_LookUp](
	[DocumentLookupId] [bigint] NOT NULL,
	[DocumentType] [nvarchar](10) NULL,
	[DocSubType] [nvarchar](10) NULL,
	[DocumentName] [nvarchar](500) NULL,
	[DocumentStatus] [tinyint] NULL,
	[SerialNo] [bigint] NULL,
	[IsCompulsary] [tinyint] NULL,
	[LinkURL] [nvarchar](500) NULL,
	[Description] [nvarchar](500) NULL,
	[tFlag] [tinyint] NULL,
 CONSTRAINT [PK_Doc_LookUp] PRIMARY KEY CLUSTERED 
(
	[DocumentLookupId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MemberRoles_Lookup]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MemberRoles_Lookup](
	[MemberRoleId] [smallint] NOT NULL,
	[MemberRoleCode] [nvarchar](5) NOT NULL,
	[MemberRoleName] [nvarchar](100) NULL,
	[MemberRoleStatus] [nvarchar](1) NULL,
 CONSTRAINT [PK_MemberRoles_Lookup_1] PRIMARY KEY CLUSTERED 
(
	[MemberRoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MemberRoleType_LookUp]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MemberRoleType_LookUp](
	[MemberRoleTypeId] [bigint] IDENTITY(1,1) NOT NULL,
	[RegistrationType] [nvarchar](5) NULL,
	[MemberRoleType] [nvarchar](50) NULL,
	[RoleType] [nvarchar](10) NULL,
	[SR_No] [tinyint] NULL,
	[status] [nchar](10) NULL,
 CONSTRAINT [PK_MemberRoleType_LookUp] PRIMARY KEY CLUSTERED 
(
	[MemberRoleTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MemberRoleType_LookUp_Fees]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MemberRoleType_LookUp_Fees](
	[LookupId] [bigint] NULL,
	[RoleType] [nvarchar](10) NULL,
	[RoleTypeFee] [money] NULL,
	[RoleTypeFee1] [money] NULL
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_LedgerMaster_CreditPer]  DEFAULT ((0)) FOR [CreditPer]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_LedgerMaster_TaxMasterId]  DEFAULT ((0)) FOR [TaxMasterId]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_LedgerMaster_MessageType]  DEFAULT ((0)) FOR [MessageType]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF__AccountMa__Credi__629F5583]  DEFAULT ((0)) FOR [CreditPrompt]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_AccountMaster_AccountStatus]  DEFAULT ((0)) FOR [RecordStatus]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_App_AccountMaster_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_App_AccountMaster_ModifedDate]  DEFAULT (getdate()) FOR [ModifedDate]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_App_Accounts_AdmissionStatus]  DEFAULT ((0)) FOR [AdmissionStatus]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_App_Accounts_Consent_1]  DEFAULT ((0)) FOR [Consent]
GO
ALTER TABLE [dbo].[App_Accounts] ADD  CONSTRAINT [DF_App_Accounts_misasiaStaus_1]  DEFAULT ((0)) FOR [misasiaStaus]
GO
ALTER TABLE [dbo].[App_Accounts_Doc] ADD  CONSTRAINT [DF_App_Accounts_Doc_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_Accounts_Doc] ADD  CONSTRAINT [DF_App_Accounts_Doc_ModifedDate]  DEFAULT (getdate()) FOR [ModifedDate]
GO
ALTER TABLE [dbo].[App_Accounts_Temp] ADD  CONSTRAINT [DF_App_Accounts_Temp_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_Accounts_Temp] ADD  CONSTRAINT [DF_App_Accounts_Temp_Consent_1]  DEFAULT ((0)) FOR [Consent]
GO
ALTER TABLE [dbo].[App_Accounts_WorkRegistration] ADD  CONSTRAINT [DF_App_Accounts_WorkNotification_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_Accounts_WorkRegistration] ADD  CONSTRAINT [DF_App_Accounts_WorkNotification_ModifedDate]  DEFAULT (getdate()) FOR [ModifedDate]
GO
ALTER TABLE [dbo].[App_BookMain] ADD  CONSTRAINT [DF_BookMain_IsBookPost]  DEFAULT ((0)) FOR [IsBookPost]
GO
ALTER TABLE [dbo].[App_BookMain] ADD  CONSTRAINT [DF_BookMain_Status]  DEFAULT ((0)) FOR [Status]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_App_BookMaster_AdvAuthorizationLevel]  DEFAULT ((0)) FOR [AdvAuthorizationLevel]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_LockRate]  DEFAULT ((0)) FOR [LockRate]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_InstantEmail]  DEFAULT ((0)) FOR [InstantEmail]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_OnlyAccounting]  DEFAULT ((0)) FOR [OnlyAccounting]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_InstantPrint]  DEFAULT ((0)) FOR [InstantPrint]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_ChangeAccount]  DEFAULT ((0)) FOR [ChangeAccount]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_ProcessCheckList]  DEFAULT ((0)) FOR [ProcessCheckList]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_ProductACPost]  DEFAULT ((0)) FOR [ProductACPost]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_RecursivePlan]  DEFAULT ((0)) FOR [RecursivePlan]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_TaxChargeLevel]  DEFAULT ((0)) FOR [TaxChargeLevel]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_BookMaster] ADD  CONSTRAINT [DF_BookMaster_ModifedDate]  DEFAULT (getdate()) FOR [ModifedDate]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_EmailSMSDate]  DEFAULT (getdate()) FOR [EmailSMSDate]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_ConfigurationType]  DEFAULT ((0)) FOR [ConfigurationType]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_ReportType]  DEFAULT ((0)) FOR [ReportType]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_FromDate]  DEFAULT (getdate()) FOR [FromDate]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_ToDate]  DEFAULT (getdate()) FOR [ToDate]
GO
ALTER TABLE [dbo].[App_EmailSMSSchedule] ADD  CONSTRAINT [DF_EmailSMSSchedule_EmailSMSSchedule]  DEFAULT ((0)) FOR [EmailSMSScheduleStatus]
GO
ALTER TABLE [dbo].[App_Geographical] ADD  CONSTRAINT [DF_App_Geogrphical_GeographiclaLevel]  DEFAULT ((1)) FOR [GeographicalLevel]
GO
ALTER TABLE [dbo].[App_Geographical] ADD  CONSTRAINT [DF_App_Geographical_RecordStatus]  DEFAULT ((0)) FOR [RecordStatus]
GO
ALTER TABLE [dbo].[App_Geographical] ADD  CONSTRAINT [DF_App_Geographical_CreateDate]  DEFAULT (getdate()) FOR [CreateDate]
GO
ALTER TABLE [dbo].[App_Geographical] ADD  CONSTRAINT [DF_App_Geographical_ModifedDate]  DEFAULT (getdate()) FOR [ModifedDate]
GO
ALTER TABLE [dbo].[MemberRoles_Lookup] ADD  CONSTRAINT [DF_MemberRoles_Lookup_MemberRoleStatus]  DEFAULT (N'Y') FOR [MemberRoleStatus]
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
GO
/****** Object:  StoredProcedure [dbo].[App_Accounts_Address_Contact_Manage_IPM]    Script Date: 06-08-2026 12:59:33 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO