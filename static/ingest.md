---
icon: lucide/database
title: HiX source tables
---

# HiX source tables

This page documents all 13 HiX source tables that are ingested into the OMOP pipeline. For each table the diagram shows how raw HiX columns (left subgraph) are renamed and cleaned in the corresponding dbt staging model (right subgraph). Arrows connect each source column to its alias; columns prefixed with `~` have no source column and are derived or set to `null` in staging.

The staging models live in `dbt/models/staging/hix/`. Each model follows the two-CTE pattern described in [Add a staging model](../how-to/staging-model.md).

---

## Admissions

Source table: `opname_opname`

```mermaid
flowchart LR
    subgraph src["opname_opname (HiX source)"]
        p_PLANNR([PLANNR])
        p_VERWIJZER([VERWIJZER])
        p_BEHANDELAA([BEHANDELAA])
        p_PATIENTNR([PATIENTNR])
        p_OPNTYPE([OPNTYPE])
        p_SPECIALISM([SPECIALISM])
        p_LOCATIE([LOCATIE])
        p_HERKOMST([HERKOMST])
        p_OPNDUUR([OPNDUUR])
        p_OPNDAT([OPNDAT])
        p_ONTSLDAT([ONTSLDAT])
        p_OPNTIJD([OPNTIJD])
        p_ONTSLTIJD([ONTSLTIJD])
    end

    subgraph stg["stg_hix__admissions (staging)"]
        s_admission_id([admission_id])
        s_referrer_id([referrer_id])
        s_physician_id([physician_id])
        s_patient_number([patient_number])
        s_admission_type([admission_type])
        s_specialism([specialism])
        s_location_type([location_type])
        s_admission_origin([admission_origin])
        s_admission_duration([admission_duration])
        s_admission_start_date([admission_start_date])
        s_admission_end_date([admission_end_date])
        s_admission_start_time([admission_start_time])
        s_admission_end_time([admission_end_time])
    end

    p_PLANNR --> s_admission_id
    p_VERWIJZER --> s_referrer_id
    p_BEHANDELAA --> s_physician_id
    p_PATIENTNR --> s_patient_number
    p_OPNTYPE --> s_admission_type
    p_SPECIALISM --> s_specialism
    p_LOCATIE --> s_location_type
    p_HERKOMST --> s_admission_origin
    p_OPNDUUR --> s_admission_duration
    p_OPNDAT --> s_admission_start_date
    p_ONTSLDAT --> s_admission_end_date
    p_OPNTIJD --> s_admission_start_time
    p_ONTSLTIJD --> s_admission_end_time
```

---

## Admission Origins

Source table: `opname_herkomst`

```mermaid
flowchart LR
    subgraph src["opname_herkomst (HiX source)"]
        p_CODE([CODE])
        p_OMSCHR([OMSCHR])
    end

    subgraph stg["stg_hix__admission_origins (staging)"]
        s_admission_origin_id([admission_origin_id])
        s_admission_origin_description([admission_origin_description])
    end

    p_CODE --> s_admission_origin_id
    p_OMSCHR --> s_admission_origin_description
```

---

## Admission Types

Source table: `opname_opntype1`

```mermaid
flowchart LR
    subgraph src["opname_opntype1 (HiX source)"]
        p_CODE([CODE])
        p_OMSCHR([OMSCHR])
    end

    subgraph stg["stg_hix__admission_types (staging)"]
        s_admission_type_id([admission_type_id])
        s_admission_type_description([admission_type_description])
    end

    p_CODE --> s_admission_type_id
    p_OMSCHR --> s_admission_type_description
```

---

## Consults

Source table: `consult_regpart`

```mermaid
flowchart LR
    subgraph src["consult_regpart (HiX source)"]
        p_PARTID([PARTID])
        p_PATIENTNR([PATIENTNR])
        p_ARTS([ARTS])
        p_CATEGORYID([CATEGORYID])
        p_SPECIALISM([SPECIALISM])
        p_CareInstance([CareInstance])
        p_TEXT([TEXT])
        p_DATE([DATE])
        p_TIME([TIME])
    end

    subgraph stg["stg_hix__consults (staging)"]
        s_consult_id([consult_id])
        s_patient_number([patient_number])
        s_physician_id([physician_id])
        s_consult_category_id([consult_category_id])
        s_specialism([specialism])
        s_care_instance([care_instance])
        s_consult_text([consult_text])
        s_consult_date([consult_date])
        s_consult_time([consult_time])
    end

    p_PARTID --> s_consult_id
    p_PATIENTNR --> s_patient_number
    p_ARTS --> s_physician_id
    p_CATEGORYID --> s_consult_category_id
    p_SPECIALISM --> s_specialism
    p_CareInstance --> s_care_instance
    p_TEXT --> s_consult_text
    p_DATE --> s_consult_date
    p_TIME --> s_consult_time
```

---

## Consult Categories

Source table: `consult_category`

```mermaid
flowchart LR
    subgraph src["consult_category (HiX source)"]
        p_CATID([CATID])
        p_NAAM([NAAM])
    end

    subgraph stg["stg_hix__consult_categories (staging)"]
        s_consult_category_id([consult_category_id])
        s_consult_category_description([consult_category_description])
    end

    p_CATID --> s_consult_category_id
    p_NAAM --> s_consult_category_description
```

---

## Diagnose Code

Source table: `episode_diag`

```mermaid
flowchart LR
    subgraph src["episode_diag (HiX source)"]
        p_code([code])
        p_omschrijv([omschrijv])
        p_langeomsch([langeomsch])
        p_specialism([specialism])
        p_datum([datum])
        p_einddatum([einddatum])
    end

    subgraph stg["stg_hix__diagnose_code (staging)"]
        s_diagnosis_code([diagnosis_code])
        s_diagnosis_description([diagnosis_description])
        s_diagnosis_description_extended([diagnosis_description_extended])
        s_specialism([specialism])
        s_diagnosis_code_start_date([diagnosis_code_start_date])
        s_diagnosis_code_end_date([diagnosis_code_end_date])
    end

    p_code --> s_diagnosis_code
    p_omschrijv --> s_diagnosis_description
    p_langeomsch --> s_diagnosis_description_extended
    p_specialism --> s_specialism
    p_datum --> s_diagnosis_code_start_date
    p_einddatum --> s_diagnosis_code_end_date
```

---

## Diagnoses and Treatments

Source table: `episode_dbcper`

```mermaid
flowchart LR
    subgraph src["episode_dbcper (HiX source)"]
        p_dbcnummer([dbcnummer])
        p_episode([episode])
        p_uitvoerder([uitvoerder])
        p_verrichtingid([verrichtingid])
        p_specialism([specialism])
        p_subspec([subspec])
        p_afsluit([afsluit])
        p_zorgtype([zorgtype])
        p_zorgvraag([zorgvraag])
        p_hoofddiag([hoofddiag])
        p_locatie([locatie])
        p_status([status])
        p_zorgprod([zorgprod])
        p_icd10([icd10])
        p_begindat([begindat])
        p_einddat([einddat])
    end

    subgraph stg["stg_hix__diagnoses_and_treatments (staging)"]
        s_diagnosis_treatment_id([diagnosis_treatment_id])
        s_episode_id([episode_id])
        s_executor([executor])
        s_treatment_id([treatment_id])
        s_specialism([specialism])
        s_sub_specialism([sub_specialism])
        s_exit_code([exit_code])
        s_care_type([care_type])
        s_care_demand_code([care_demand_code])
        s_main_diagnosis([main_diagnosis])
        s_location([location])
        s_status_code([status_code])
        s_care_product([care_product])
        s_icd10_code([icd10_code])
        s_diagnose_code([diagnose_code])
        s_episode_start_date([episode_start_date])
        s_episode_end_date([episode_end_date])
    end

    p_dbcnummer --> s_diagnosis_treatment_id
    p_episode --> s_episode_id
    p_uitvoerder --> s_executor
    p_verrichtingid --> s_treatment_id
    p_specialism --> s_specialism
    p_subspec --> s_sub_specialism
    p_afsluit --> s_exit_code
    p_zorgtype --> s_care_type
    p_zorgvraag --> s_care_demand_code
    p_hoofddiag --> s_main_diagnosis
    p_locatie --> s_location
    p_status --> s_status_code
    p_zorgprod --> s_care_product
    p_icd10 --> s_icd10_code
    p_hoofddiag --> s_diagnose_code
    p_begindat --> s_episode_start_date
    p_einddat --> s_episode_end_date
```

---

## Episodes

Source table: `episode_episode`

```mermaid
flowchart LR
    subgraph src["episode_episode (HiX source)"]
        p_episode([episode])
        p_patientnr([patientnr])
        p_verwijsnr([verwijsnr])
        p_omschr([omschr])
        p_specialism([specialism])
        p_locatie([locatie])
        p_zorgtype([zorgtype])
        p_hoofddiag([hoofddiag])
        p_begindat([begindat])
        p_einddat([einddat])
        p_einddatdbc([einddatdbc])
    end

    subgraph stg["stg_hix__episodes (staging)"]
        s_episode_id([episode_id])
        s_patient_number([patient_number])
        s_referral_number([referral_number])
        s_episode_description([episode_description])
        s_specialism([specialism])
        s_episode_location([episode_location])
        s_care_type([care_type])
        s_diagnose_code([diagnose_code])
        s_episode_start_date([episode_start_date])
        s_episode_end_date([episode_end_date])
        s_episode_dbc_end_date([episode_dbc_end_date])
    end

    p_episode --> s_episode_id
    p_patientnr --> s_patient_number
    p_verwijsnr --> s_referral_number
    p_omschr --> s_episode_description
    p_specialism --> s_specialism
    p_locatie --> s_episode_location
    p_zorgtype --> s_care_type
    p_hoofddiag --> s_diagnose_code
    p_begindat --> s_episode_start_date
    p_einddat --> s_episode_end_date
    p_einddatdbc --> s_episode_dbc_end_date
```

---

## Lab Requests

Source table: `lab_l_aanvrg`

```mermaid
flowchart LR
    subgraph src["lab_l_aanvrg (HiX source)"]
        p_AANVRAAGNR([AANVRAAGNR])
        p_AANVRAGER([AANVRAGER])
        p_PATIENTNR([PATIENTNR])
        p_AFDATUM([AFDATUM])
        p_ZENDDATUM([ZENDDATUM])
        p_AFTIJD([AFTIJD])
        p_SENDTIME([SENDTIME])
    end

    subgraph stg["stg_hix__lab_requests (staging)"]
        s_lab_request_id([lab_request_id])
        s_referrer_id([referrer_id])
        s_physician_id([~ physician_id])
        s_patient_number([patient_number])
        s_lab_request_start_date([lab_request_start_date])
        s_lab_request_end_date([lab_request_end_date])
        s_lab_request_start_time([lab_request_start_time])
        s_lab_request_end_time([lab_request_end_time])
    end

    p_AANVRAAGNR --> s_lab_request_id
    p_AANVRAGER --> s_referrer_id
    p_PATIENTNR --> s_patient_number
    p_AFDATUM --> s_lab_request_start_date
    p_ZENDDATUM --> s_lab_request_end_date
    p_AFTIJD --> s_lab_request_start_time
    p_SENDTIME --> s_lab_request_end_time
```

---

## Medication

Source table: `medicat_recdeel`

```mermaid
flowchart LR
    subgraph src["medicat_recdeel (HiX source)"]
        p_IDENTIF([IDENTIF])
        p_PATIENTNR([PATIENTNR])
        p_MEDCD([MEDCD])
        p_IssueRequestDurationUnit([IssueRequestDurationUnit])
        p_EXDISPL([EXDISPL])
        p_DeliveryUnitCode([DeliveryUnitCode])
        p_TOEDCD([TOEDCD])
        p_VRSCHRTYP([VRSCHRTYP])
        p_STPREDEN([STPREDEN])
        p_REGTYPE([REGTYPE])
        p_APOTHCODE([APOTHCODE])
        p_TOEDOMS([TOEDOMS])
        p_GROEPOMS([GROEPOMS])
        p_SCHEMCD([SCHEMCD])
        p_IssueRequestDurationAmount([IssueRequestDurationAmount])
        p_Repetitions([Repetitions])
        p_DeliveryAmount([DeliveryAmount])
        p_VRSCHRDAT([VRSCHRDAT])
        p_InitialStopDate([InitialStopDate])
        p_ACCTD([ACCTD])
    end

    subgraph stg["stg_hix__medication (staging)"]
        s_prescription_id([prescription_id])
        s_patient_number([patient_number])
        s_medicine_id([medicine_id])
        s_duration_code([duration_code])
        s_explanation([explanation])
        s_delivery_unit_code([delivery_unit_code])
        s_administration_code([administration_code])
        s_prescription_type([prescription_type])
        s_stop_reason([stop_reason])
        s_registration_type([registration_type])
        s_pharmacy_code([pharmacy_code])
        s_administration_method([administration_method])
        s_medication_group([medication_group])
        s_schema_code([schema_code])
        s_duration([duration])
        s_repetitions([repetitions])
        s_delivery_amount([delivery_amount])
        s_prescription_start_date([prescription_start_date])
        s_prescription_end_date([prescription_end_date])
        s_prescription_start_time([prescription_start_time])
    end

    p_IDENTIF --> s_prescription_id
    p_PATIENTNR --> s_patient_number
    p_MEDCD --> s_medicine_id
    p_IssueRequestDurationUnit --> s_duration_code
    p_EXDISPL --> s_explanation
    p_DeliveryUnitCode --> s_delivery_unit_code
    p_TOEDCD --> s_administration_code
    p_VRSCHRTYP --> s_prescription_type
    p_STPREDEN --> s_stop_reason
    p_REGTYPE --> s_registration_type
    p_APOTHCODE --> s_pharmacy_code
    p_TOEDOMS --> s_administration_method
    p_GROEPOMS --> s_medication_group
    p_SCHEMCD --> s_schema_code
    p_IssueRequestDurationAmount --> s_duration
    p_Repetitions --> s_repetitions
    p_DeliveryAmount --> s_delivery_amount
    p_VRSCHRDAT --> s_prescription_start_date
    p_InitialStopDate --> s_prescription_end_date
    p_ACCTD --> s_prescription_start_time
```

---

## Medicines

Source table: `medicat_medicijn`

```mermaid
flowchart LR
    subgraph src["medicat_medicijn (HiX source)"]
        p_CODE([CODE])
        p_OMSCHR([OMSCHR])
        p_ATCCODE([ATCCODE])
        p_ZNDXART([ZNDXART])
        p_ZNDXHPK([ZNDXHPK])
        p_ZNDXPRK([ZNDXPRK])
        p_ZNDXGPK([ZNDXGPK])
    end

    subgraph stg["stg_hix__medicines (staging)"]
        s_medicine_id([medicine_id])
        s_medicine_description([medicine_description])
        s_atc_code([atc_code])
        s_z_index([z_index])
        s_z_index_hpk([z_index_hpk])
        s_z_index_prk([z_index_prk])
        s_z_index_gpk([z_index_gpk])
    end

    p_CODE --> s_medicine_id
    p_OMSCHR --> s_medicine_description
    p_ATCCODE --> s_atc_code
    p_ZNDXART --> s_z_index
    p_ZNDXHPK --> s_z_index_hpk
    p_ZNDXPRK --> s_z_index_prk
    p_ZNDXGPK --> s_z_index_gpk
```

---

## Patients

Source table: `patient_patient`

```mermaid
flowchart LR
    subgraph src["patient_patient (HiX source)"]
        p_PATIENTNR([PATIENTNR])
        p_GESLACHT([GESLACHT])
        p_ADRES([ADRES])
        p_HUISNR([HUISNR])
        p_POSTCODE([POSTCODE])
        p_WOONPLAATS([WOONPLAATS])
        p_LAND([LAND])
        p_HUISARTS([HUISARTS])
        p_GEBDAT([GEBDAT])
        p_GEBOORTETIJD([GEBOORTETIJD])
    end

    subgraph stg["stg_hix__patients (staging)"]
        s_patient_number([patient_number])
        s_gender([gender])
        s_street([street])
        s_house_number([house_number])
        s_zip_code([zip_code])
        s_city([city])
        s_country([country])
        s_general_practitioner([general_practitioner])
        s_birth_date([birth_date])
        s_birth_time([birth_time])
    end

    p_PATIENTNR --> s_patient_number
    p_GESLACHT --> s_gender
    p_ADRES --> s_street
    p_HUISNR --> s_house_number
    p_POSTCODE --> s_zip_code
    p_WOONPLAATS --> s_city
    p_LAND --> s_country
    p_HUISARTS --> s_general_practitioner
    p_GEBDAT --> s_birth_date
    p_GEBOORTETIJD --> s_birth_time
```

---

## Units

Source table: `medicat_eenheid`

```mermaid
flowchart LR
    subgraph src["medicat_eenheid (HiX source)"]
        p_CODE([CODE])
        p_OMSCHR([OMSCHR])
    end

    subgraph stg["stg_hix__units (staging)"]
        s_unit_id([unit_id])
        s_unit_description([unit_description])
    end

    p_CODE --> s_unit_id
    p_OMSCHR --> s_unit_description
```
