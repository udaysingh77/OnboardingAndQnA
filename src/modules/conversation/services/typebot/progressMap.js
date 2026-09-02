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
  ofaqjfre4b6smht07inyag0w:   3, // choice input (Individual) Author / Composer
  flgpd2vixmu0djiomet77kmn:   6, // choice input EntityType
  mdqj3iyf81wm5p5ihbs4gkoo:   6, // choice input I Accept
  oxw82owm9r4i9d24eat8mgzs:   6, // choice input I Accept
  pdxi4upcgfjmrdhfcut6g7r5:   8, // choice input I Accept
  i1e0ui8ulp9upo2qo6n9hzx5:   9, // choice input I Accept
  kw6hmomfcpco0h1o7k7a5q31:   9, // choice input I Accept
  dfjq3jnt9camad1fz1g80fj5:  10, // choice input I Accept
  dha20qnmgdroevgtjahyvgq4:  10, // choice input I Accept
  yx4om90mie9j0ol0d8s3jo2r:  10, // choice input I Accept
  ahyzplqvx3ui5juwrrox3ueu:  12, // choice input I Accept
  f8oqkbtb5aod4zixk9g61p4k:  12, // text input   email
  fvuq2fhprp6lglzwaymzbax1:  12, // text input   email
  demje4616e1wsj8sndh5u6xp:  13, // choice input I Accept
  lhn01sxvz2v2e4t3rekoqej7:  13, // choice input I Accept
  pngh7jejhf2y9ewxztmu815l:  13, // choice input I Accept
  b7635myaqyeudck8wk20ml1l:  15, // text input   email
  pz63sk8srnnwtctc4bg4sxto:  15, // text input   place_of_birth
  r5yv2rbnzed9r6m3870yr7l6:  15, // choice input gst_options
  oq9t8my7r1eosq7d5438g5x8:  16, // file input   MAA_Upload
  sqz4yjzlstxdju4e5ebp3uoq:  16, // file input   TUM_Upload
  teoi74ucijg9o4kn1pasfr3m:  17, // file input   PartnerD_upload
  ibbe01buu9psnjogoq0unpjw:  18, // choice input role
  paqezgvjit32irt79tl5pc38:  18, // text input   gst_no
  n5zfjvv6ugnj1i6qrwph35vl:  19, // file input   selfDecleration_upload
  vcfzj48k42e2mtv7ijh96gc5:  19, // file input   BR_Upload
  vfvvwcz6g7ueiw2lhqnwvg9z:  19, // text input   place_of_birth
  wo33kybz0dcp0hawk4f6yis7:  20, // file input   AuthorityLetter_Upload
  xsj8j0zvs2ao5qdwr9m0hzv3:  21, // choice input Yes
  z0yx9nnq5i3p1t1pb7v44pcy:  21, // text input   designation
  e5s5cxj9n6eh6ubaz573m0vx:  23, // file input   company_noc
  qvo8thfagkj2mixdoj382da4:  23, // choice input role
  wddfpadpnsiw8fpc1w5z05n1:  23, // file input   letter
  fmxzyrlpsf9zjmk9exsi3ek3:  24, // text input   gst_no
  h0nif8vdjloh9eytol30imnc:  24, // choice input Yes
  ks91rw3cq2xrxt1099yy2516:  26, // text input   assosiation_name
  s1x2bk8lawg44n75cnhxqqz9:  26, // text input   email
  a5aujns6i7dhbqklnl755gpv:  27, // choice input Yes
  vws1gmd9irrbu70mlxxcx3zi:  27, // choice input Yes
  fibjujil57kdwaiex3vosqzm:  29, // choice input Yes, I’ll type it
  rq2atmhhs9siv7psmxmg636n:  29, // file input   company_pan
  n2u940qt8ltxoltppyvmfxpn:  30, // choice input teritory
  ktd9g9e08s6uz1tddf0imyye:  31, // text input   gst_no
  up4you8ef2sxppryl6ie6cp1:  32, // text input   designation
  w9hjqpdkcyjqxdc64tv9u89g:  32, // text input   chanel_desc
  epndixa98cgkdrjnul7he2xt:  33, // file input   Noc
  memgr2g4fj0bth4czl4v3l0w:  35, // choice input Yes
  ml1pehw1jjrzcbflrezsarl7:  35, // file input   company_photo
  oqg4nwlfseo7drc66aq10m9e:  35, // choice input Yes
  edgjtvqj0i5qwjfv0r1zkedd:  36, // file input   photo
  dup21pngh3d0pai4oxxjcqzs:  38, // text input   assosiation_name
  q18gas1hym790bfnrtp5mpcd:  38, // choice input address_proof_type_current
  et7njpjjc6gwz95rmdcr30nt:  39, // file input   passport_indivisual
  g2c93kyw19nogtv0sjhpowuy:  39, // text input   assosiation_name
  dpxeg6y2w8fof0r4ftp2ft53:  41, // text input   registered_address_type
  k125w7fe75aqhv7gthubusai:  41, // file input   registered_address
  cbeexxvp4afbdv21ch60conz:  42, // choice input Yes, I’ll type it
  j40owea6u92m53dxgpnwace5:  42, // choice input Yes
  krk5m92ihv5kaildp8jajdxj:  42, // file input   TRC
  cbmqojadjfm2jmbk9c17a59q:  44, // choice input Yes
  pxkfaxu6vkui9uv1by5mgua9:  45, // choice input Yes
  t9nsr5eogpk34tqtghgbotqu:  45, // text input   chanel_desc
  ni0xbtx0htpr10x1setrq4u3:  46, // choice input teritory
  cyci95gi706rpw8tva4e3ouo:  47, // choice input address_proof_type_current
  nyx2jmkbywlvf5ixvinjii2a:  48, // text input   assosiation_name
  tj7pvwqhic7u6rmq436bhtvf:  48, // file input   company_photo
  bl3ree1x725036j6wax3uav7:  50, // file input   comm_address2
  g5frg3j9pemyoidcvobsa2px:  50, // text input   comm_address2_type
  o5n5chjkhwof7ytyks400haq:  50, // file input   Noc
  kg2i35l2491u5hopas7stdg4:  52, // choice input address_proof_type_current
  z0kyyoqr5nez31rlfpk5ppdv:  52, // text input   nationality
  lezz4jxutykbfoq2r3ae0jkq:  53, // choice input Yes
  vqwuvk0vnzab8eol51i86j64:  54, // file input   photo
  w8beaa44i3s8v46gzwhkbgzz:  55, // choice input dual_nationality
  yvahr8qbkgfhfuonsrkr49mq:  55, // file input   registered_address
  qx9rpzvntiprq90gx1np7bmj:  56, // choice input teritory
  ddk7tlmjhkvt3zktskzt9i9e:  58, // choice input Yes
  x1a4lvyxz085pfhyppef6wnc:  58, // file input   pan_card
  yoh1r11iqch1dipaar7r6pl1:  58, // file input   passbook
  a1b4f5e5unw1ithjp4r5siw5:  59, // file input   Noc
  csntwzyr0k418idnaxk0ha45:  61, // choice input address_proof_type_permanent
  if0fvqm05icv3tuyc3xjc7dj:  61, // choice input address_proof_type_current
  nqyxmnuusz3bq26r0obbmfpl:  62, // file input   passbook
  wiccvvam9g4d7c8ary2kulhu:  62, // file input   passbook
  xqu8sijb9p92shdewvy5qumj:  64, // text input   P_address
  zr5z6lvgo3tmjkktva9oc2ql:  64, // file input   permanent_address_proof
  gazeo8w40fwvbhuj5a06ftp6:  65, // file input   entity_incorporation_upload
  rpij8g7ou2lertf1xe46bwnc:  65, // choice input address_proof_type_permanent
  ybcl5sixj22vlhc8llzu49kl:  65, // file input   comm_address
  ctpx2z89l8pqltt5ehahmq3a:  67, // choice input Yes
  vt6oqxd2g7pvbcxegcfbq2vk:  68, // file input   trc_upload
  xwnj50axf9xtvy10ljg1eaie:  68, // choice input Yes
  dqphd61tvxp3p2l7jkbyqceh:  69, // file input   permanent_address_proof
  inks0tdl2dbonehscrbhbfqr:  70, // choice input address_proof_type_current
  it7obzdjqi9i5kqsbxz3tffm:  71, // choice input teritory
  o7abkrvjgi0m9p8i0q5qhfob:  71, // file input   tin_upload
  i8v9h0dszpnwphwwl2mxf6te:  73, // choice input Yes
  vhickdt8h7avyu2g85e2uooh:  73, // text input   c_address
  vn7pcvzfjzr8xmrkjx9tzwai:  73, // file input   current_address_proof
  jl6epop3i1iaiwhib5xr5d8d:  74, // file input   SS_NumberUpload
  s2g4n58d2ogyr9wp04242yka:  74, // file input   Noc
  iyo96vyr3j95r4qvzw342uhc:  76, // file input   tin_upload
  ofbhr8kfld8x54f5601rb283:  76, // file input   PEC_Upload
  k05fwzssw7yfyu41xik34ast:  77, // file input   passbook
  tk1kdh0b1j6uzvacoo34rp1i:  77, // choice input address_proof_type_current
  kz2xvxsybq3whe6rh01bjqwf:  79, // choice input address_proof_type_current
  vsg89mcrd3pam5m7frypfh0n:  79, // file input   selfDecleration_upload
  jepno1g51m3s76v79kmyukj1:  81, // file input   current_address_proof
  mtj6wazphq42jv0oadtnlozs:  81, // choice input Yes, I’ll upload it
  bg3vzcmdf25l481nt8dwi80r:  82, // file input   comm_address
  o30tr1wttrzh7tc1a7e6gkw2:  82, // file input   SS_NumberUpload
  p5efmf064weo8nardhmx9buy:  84, // file input   gst_certificate_upload
  dpu1p9v8ysxhkddq2fm73esb:  85, // file input   Form41_upload
  e6n9bs69j5r8vejql1qb9yhd:  85, // file input   Form41_upload
  qje5cvxfiyeyulko9vb54wqb:  85, // choice input Yes, I have an alias/stage name
  mpja7mu3exf9537puaxmjjn1:  87, // choice input Yes, I have an alias/stage name
  abpyq4uj0w5512l0clblw6zx:  88, // text input   stageName
  n2pckdbd7ikeetef0k37e9i3:  88, // choice input Yes, I have an alias/stage name
  vbib8eovbot8wizsq2ixu9ie:  88, // file input   letter
  k1pcwt23nmp7s2m9517t2y8b:  90, // text input   traderName
  xgpnjbhvc7ku42ks8asqyhd4:  91, // text input   traderName
  xp4ynnlivpqzok1byzpgeo8p:  91, // text input   stageName
  t7rxqa45lzxn3c20au3xczjd:  92, // url input    workUrl
  s3ve6kasl1rkiun2n9fgtjxu:  94, // url input    workUrl
  uycu77l5avn789uonzyw4nd1:  94, // url input    workUrl
  xnbvoocex284qeg48jbi6ufr:  94, // url input    workUrl
  ufpca0wnuwznk2ks7qbv39py:  96, // choice input Pay
  mqd5zfukd99nkczylu206jo1:  97, // choice input payment
  o6vjstq2do6uuy67wfbzg451:  97, // choice input payment
  tjbgzghma2th8et9srotmzt5:  97, // choice input Pay
};

// null for an unknown block - the caller passes that straight through, so a block added in Studio
// before this map is regenerated shows no progress rather than a wrong one.
export function resolveProgress(blockId) {
  return PROGRESS_BY_BLOCK[blockId] ?? null;
}
