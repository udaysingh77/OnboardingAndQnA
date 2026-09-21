// ==================================================================
// GENERATED FILE - do not edit by hand.
//   npm run build:progress-map
// Re-run it after every Studio republish. See scripts/build-progress-map.mjs.
//
// Typebot's Chat API never returns a `progress` field (confirmed live -
// startChat/continueChat responses only ever carry sessionId/resultId/
// typebot/messages/input/clientSideActions/logs; Studio's "Enable
// progress bar" toggle only affects Typebot's own embed widget, not the
// API). This backend drives the conversation by API relay, not the
// embed, so progress has to be computed here.
//
// Each value is "questions already answered / questions on this path",
// computed per block from the published flow's graph. It is NOT measured
// against a single global step count: the four role paths run 26 to 34
// questions, and one shared total would leave the short paths stuck
// below 100% forever.
//
// Nothing here reaches 100 on purpose - registrationEngine.handle()
// forces 100 when the session actually ends, and while the payment
// button is still on screen the member hasn't finished.
//
// Verified at generation time: progress never decreases along any edge.
// ==================================================================
const PROGRESS_BY_BLOCK = {
  tebp7htyvolml8wokttg66pw:   0, // choice input Yes, I want to become a member
  ofaqjfre4b6smht07inyag0w:   3, // choice input applicantPath
  flgpd2vixmu0djiomet77kmn:   6, // choice input EntityType
  mdqj3iyf81wm5p5ihbs4gkoo:   6, // choice input I Accept
  oxw82owm9r4i9d24eat8mgzs:   6, // choice input I Accept
  pdxi4upcgfjmrdhfcut6g7r5:   7, // choice input I Accept
  dha20qnmgdroevgtjahyvgq4:   9, // choice input I Accept
  i1e0ui8ulp9upo2qo6n9hzx5:   9, // choice input I Accept
  kw6hmomfcpco0h1o7k7a5q31:   9, // choice input I Accept
  yx4om90mie9j0ol0d8s3jo2r:   9, // choice input I Accept
  dfjq3jnt9camad1fz1g80fj5:  10, // choice input I Accept
  ahyzplqvx3ui5juwrrox3ueu:  11, // choice input I Accept
  fvuq2fhprp6lglzwaymzbax1:  11, // text input   email
  f8oqkbtb5aod4zixk9g61p4k:  12, // text input   email
  demje4616e1wsj8sndh5u6xp:  13, // choice input I Accept
  lhn01sxvz2v2e4t3rekoqej7:  13, // choice input I Accept
  pngh7jejhf2y9ewxztmu815l:  13, // choice input I Accept
  r5yv2rbnzed9r6m3870yr7l6:  14, // choice input gst_options
  b7635myaqyeudck8wk20ml1l:  15, // text input   email
  pz63sk8srnnwtctc4bg4sxto:  15, // text input   place_of_birth
  oq9t8my7r1eosq7d5438g5x8:  16, // file input   MAA_Upload
  sqz4yjzlstxdju4e5ebp3uoq:  16, // file input   TUM_Upload
  teoi74ucijg9o4kn1pasfr3m:  16, // file input   PartnerD_upload
  paqezgvjit32irt79tl5pc38:  17, // text input   gst_no
  ibbe01buu9psnjogoq0unpjw:  18, // choice input role
  n5zfjvv6ugnj1i6qrwph35vl:  19, // file input   selfDecleration_upload
  vcfzj48k42e2mtv7ijh96gc5:  19, // file input   BR_Upload
  vfvvwcz6g7ueiw2lhqnwvg9z:  19, // text input   place_of_birth
  wo33kybz0dcp0hawk4f6yis7:  19, // file input   AuthorityLetter_Upload
  z0yx9nnq5i3p1t1pb7v44pcy:  20, // text input   designation
  xsj8j0zvs2ao5qdwr9m0hzv3:  21, // choice input Yes
  e5s5cxj9n6eh6ubaz573m0vx:  22, // file input   company_noc
  qvo8thfagkj2mixdoj382da4:  22, // choice input role
  wddfpadpnsiw8fpc1w5z05n1:  22, // file input   letter
  ks6q7z5mrubjqemaxa4f4eq4:  23, // text input   MotherTounge
  fmxzyrlpsf9zjmk9exsi3ek3:  24, // text input   gst_no
  s1x2bk8lawg44n75cnhxqqz9:  25, // text input   email
  a5aujns6i7dhbqklnl755gpv:  26, // choice input Yes
  h0nif8vdjloh9eytol30imnc:  26, // choice input Yes
  vws1gmd9irrbu70mlxxcx3zi:  26, // choice input Yes
  rq2atmhhs9siv7psmxmg636n:  28, // file input   company_pan
  ks91rw3cq2xrxt1099yy2516:  29, // text input   assosiation_name
  n2u940qt8ltxoltppyvmfxpn:  29, // choice input teritory
  ktd9g9e08s6uz1tddf0imyye:  30, // text input   gst_no
  fibjujil57kdwaiex3vosqzm:  31, // choice input Yes, I’ll type it
  up4you8ef2sxppryl6ie6cp1:  31, // text input   designation
  epndixa98cgkdrjnul7he2xt:  32, // file input   Noc
  oqg4nwlfseo7drc66aq10m9e:  33, // choice input Yes
  dwt2rzc2jk3wiehx901m0eu1:  34, // text input   MotherTounge
  w9hjqpdkcyjqxdc64tv9u89g:  34, // text input   chanel_desc
  edgjtvqj0i5qwjfv0r1zkedd:  35, // file input   photo
  dup21pngh3d0pai4oxxjcqzs:  37, // text input   assosiation_name
  ml1pehw1jjrzcbflrezsarl7:  37, // file input   company_photo
  memgr2g4fj0bth4czl4v3l0w:  38, // choice input Yes
  xahqzzlwvjiv0rdk1ub30j8o:  38, // text input   MotherTounge
  q18gas1hym790bfnrtp5mpcd:  40, // choice input address_proof_type_current
  et7njpjjc6gwz95rmdcr30nt:  41, // file input   passport_indivisual
  g2c93kyw19nogtv0sjhpowuy:  41, // text input   assosiation_name
  q3xl3vlud9r71twny3xpj5uz:  41, // text input   MotherTounge
  dpxeg6y2w8fof0r4ftp2ft53:  43, // text input   registered_address_type
  k125w7fe75aqhv7gthubusai:  43, // file input   registered_address
  cbeexxvp4afbdv21ch60conz:  44, // choice input Yes, I’ll type it
  j40owea6u92m53dxgpnwace5:  44, // choice input Yes
  krk5m92ihv5kaildp8jajdxj:  44, // file input   TRC
  cbmqojadjfm2jmbk9c17a59q:  46, // choice input Yes
  pxkfaxu6vkui9uv1by5mgua9:  47, // choice input Yes
  t9nsr5eogpk34tqtghgbotqu:  47, // text input   chanel_desc
  ni0xbtx0htpr10x1setrq4u3:  48, // choice input teritory
  cyci95gi706rpw8tva4e3ouo:  49, // choice input address_proof_type_current
  nyx2jmkbywlvf5ixvinjii2a:  50, // text input   assosiation_name
  tj7pvwqhic7u6rmq436bhtvf:  50, // file input   company_photo
  bl3ree1x725036j6wax3uav7:  51, // file input   comm_address2
  g5frg3j9pemyoidcvobsa2px:  51, // text input   comm_address2_type
  o5n5chjkhwof7ytyks400haq:  52, // file input   Noc
  kg2i35l2491u5hopas7stdg4:  53, // choice input address_proof_type_current
  z0kyyoqr5nez31rlfpk5ppdv:  53, // text input   nationality
  lezz4jxutykbfoq2r3ae0jkq:  54, // choice input Yes
  vqwuvk0vnzab8eol51i86j64:  56, // file input   photo
  w8beaa44i3s8v46gzwhkbgzz:  56, // choice input dual_nationality
  yvahr8qbkgfhfuonsrkr49mq:  56, // file input   registered_address
  qx9rpzvntiprq90gx1np7bmj:  57, // choice input teritory
  ddk7tlmjhkvt3zktskzt9i9e:  59, // choice input Yes
  x1a4lvyxz085pfhyppef6wnc:  59, // file input   pan_card
  yoh1r11iqch1dipaar7r6pl1:  59, // file input   passbook
  a1b4f5e5unw1ithjp4r5siw5:  60, // file input   Noc
  csntwzyr0k418idnaxk0ha45:  62, // choice input address_proof_type_permanent
  if0fvqm05icv3tuyc3xjc7dj:  63, // choice input address_proof_type_current
  nqyxmnuusz3bq26r0obbmfpl:  63, // file input   passbook
  wiccvvam9g4d7c8ary2kulhu:  63, // file input   passbook
  xqu8sijb9p92shdewvy5qumj:  65, // text input   P_address
  zr5z6lvgo3tmjkktva9oc2ql:  65, // file input   permanent_address_proof
  gazeo8w40fwvbhuj5a06ftp6:  66, // file input   entity_incorporation_upload
  ybcl5sixj22vlhc8llzu49kl:  66, // file input   comm_address
  rpij8g7ou2lertf1xe46bwnc:  67, // choice input address_proof_type_permanent
  ctpx2z89l8pqltt5ehahmq3a:  68, // choice input Yes
  vt6oqxd2g7pvbcxegcfbq2vk:  69, // file input   trc_upload
  xwnj50axf9xtvy10ljg1eaie:  69, // choice input Yes
  dqphd61tvxp3p2l7jkbyqceh:  70, // file input   permanent_address_proof
  inks0tdl2dbonehscrbhbfqr:  71, // choice input address_proof_type_current
  o7abkrvjgi0m9p8i0q5qhfob:  71, // file input   tin_upload
  it7obzdjqi9i5kqsbxz3tffm:  72, // choice input teritory
  i8v9h0dszpnwphwwl2mxf6te:  74, // choice input Yes
  jl6epop3i1iaiwhib5xr5d8d:  74, // file input   SS_NumberUpload
  vhickdt8h7avyu2g85e2uooh:  74, // text input   c_address
  vn7pcvzfjzr8xmrkjx9tzwai:  74, // file input   current_address_proof
  s2g4n58d2ogyr9wp04242yka:  75, // file input   Noc
  iyo96vyr3j95r4qvzw342uhc:  76, // file input   tin_upload
  ofbhr8kfld8x54f5601rb283:  77, // file input   PEC_Upload
  k05fwzssw7yfyu41xik34ast:  78, // file input   passbook
  tk1kdh0b1j6uzvacoo34rp1i:  78, // choice input address_proof_type_current
  vsg89mcrd3pam5m7frypfh0n:  79, // file input   selfDecleration_upload
  kz2xvxsybq3whe6rh01bjqwf:  80, // choice input address_proof_type_current
  jepno1g51m3s76v79kmyukj1:  81, // file input   current_address_proof
  mtj6wazphq42jv0oadtnlozs:  81, // choice input Yes, I’ll upload it
  o30tr1wttrzh7tc1a7e6gkw2:  82, // file input   SS_NumberUpload
  bg3vzcmdf25l481nt8dwi80r:  83, // file input   comm_address
  p5efmf064weo8nardhmx9buy:  84, // file input   gst_certificate_upload
  dpu1p9v8ysxhkddq2fm73esb:  85, // file input   Form41_upload
  qje5cvxfiyeyulko9vb54wqb:  85, // choice input Yes, I have an alias/stage name
  e6n9bs69j5r8vejql1qb9yhd:  86, // file input   Form41_upload
  mpja7mu3exf9537puaxmjjn1:  88, // choice input Yes, I have an alias/stage name
  n2pckdbd7ikeetef0k37e9i3:  88, // choice input Yes, I have an alias/stage name
  abpyq4uj0w5512l0clblw6zx:  89, // text input   stageName
  vbib8eovbot8wizsq2ixu9ie:  89, // file input   letter
  k1pcwt23nmp7s2m9517t2y8b:  91, // text input   traderName
  xgpnjbhvc7ku42ks8asqyhd4:  91, // text input   traderName
  xp4ynnlivpqzok1byzpgeo8p:  91, // text input   stageName
  t7rxqa45lzxn3c20au3xczjd:  93, // url input    workUrl
  s3ve6kasl1rkiun2n9fgtjxu:  94, // url input    workUrl
  uycu77l5avn789uonzyw4nd1:  94, // url input    workUrl
  xnbvoocex284qeg48jbi6ufr:  94, // url input    workUrl
  ufpca0wnuwznk2ks7qbv39py:  96, // choice input Pay Application Fee
  mqd5zfukd99nkczylu206jo1:  97, // choice input Pay Application Fee
  o6vjstq2do6uuy67wfbzg451:  97, // choice input Pay Application Fee
  tjbgzghma2th8et9srotmzt5:  97, // choice input Pay Application Fee
};

// null for an unknown block - the caller passes that straight through, so a block added in Studio
// before this map is regenerated shows no progress rather than a wrong one.
export function resolveProgress(blockId) {
  return PROGRESS_BY_BLOCK[blockId] ?? null;
}
