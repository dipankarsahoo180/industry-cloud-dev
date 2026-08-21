// Use .apex files to store anonymous Apex.
// You can execute anonymous Apex in VS Code by selecting the
//     apex text and running the command:
//     SFDX: Execute Anonymous Apex with Currently Selected Text
// You can also execute the entire file by running the command:
//     SFDX: Execute Anonymous Apex with Editor Contents

/*
 * Safely deletes every Care Plan associated with the student Contact on one Case.
 * Care Plans are matched by ParticipantId across all Cases for that student.
 *
 * Usage:
 *   1. Set caseIdText to the source Case Id.
 *   2. Run once with doDelete = false and review the USER_DEBUG preview.
 *   3. Set doDelete = true and run again to perform the deletion.
 *
 * Example command:
 *   sf apex run --target-org unm-devl --file scripts/apex/UNM_Delete_Student_Care_Plan.apex
 *
 * This script deliberately does NOT delete the Case, Contact, or CaseParticipant.
 */

String caseIdText = '500f600000Gu1bXAAR';
Boolean doDelete = true;

System.assert(
    !caseIdText.startsWith('REPLACE_'),
    'Set caseIdText to the source Case Id before running this script.'
);

List<Case> matchedCases = [
    SELECT Id, CaseNumber, ContactId, Contact.Name
    FROM Case
    WHERE Id = :caseIdText
    LIMIT 1
];

System.assertEquals(
    1,
    matchedCases.size(),
    'No Case matched the supplied Case Id. Nothing was deleted.'
);

Case sourceCase = matchedCases[0];
System.assertNotEquals(
    null,
    sourceCase.ContactId,
    'The supplied Case has no Contact. Nothing was deleted.'
);

Id studentContactId = sourceCase.ContactId;

List<CarePlan> carePlansToDelete = [
    SELECT Id, Name, CaseId, ParticipantId, Status, StartDate, EndDate
    FROM CarePlan
    WHERE ParticipantId = :studentContactId
    ORDER BY CreatedDate ASC
];

Set<Id> carePlanIds = new Map<Id, CarePlan>(carePlansToDelete).keySet();

List<GoalAssignment> goalAssignments = [
    SELECT Id, GoalDefinitionId, GoalAssigneeId, Status, ParentRecordId
    FROM GoalAssignment
    WHERE ParentRecordId IN :carePlanIds
];

Set<Id> goalAssignmentIds = new Map<Id, GoalAssignment>(goalAssignments).keySet();

// Benefit Assignments can be parented directly to the Care Plan or attached to one
// of its Goal Assignments; a Goal Assignment can't be deleted while either exists.
// The exact API name of the Goal Assignment reference field varies by org setup,
// so discover it from the schema instead of hardcoding a guess.
Set<String> benefitAssignmentGoalRefFields = new Set<String>();
Map<String, Schema.SObjectField> benefitAssignmentFieldMap = Schema.SObjectType.BenefitAssignment.fields.getMap();
for (String fieldName : benefitAssignmentFieldMap.keySet()) {
    Schema.DescribeFieldResult fieldDescribe = benefitAssignmentFieldMap.get(fieldName).getDescribe();
    for (Schema.SObjectType refType : fieldDescribe.getReferenceTo()) {
        if (refType == GoalAssignment.SObjectType) {
            benefitAssignmentGoalRefFields.add(fieldDescribe.getName());
        }
    }
}

String benefitAssignmentQuery = 'SELECT Id, BenefitId, EnrolleeId, Status, ParentRecordId FROM BenefitAssignment WHERE ParentRecordId IN :carePlanIds';
for (String goalRefField : benefitAssignmentGoalRefFields) {
    benefitAssignmentQuery += ' OR ' + goalRefField + ' IN :goalAssignmentIds';
}
System.debug(LoggingLevel.WARN, 'Benefit Assignment fields referencing Goal Assignment: ' + benefitAssignmentGoalRefFields);
List<BenefitAssignment> benefitAssignments = Database.query(benefitAssignmentQuery);

List<ActionPlan> actionPlans = [
    SELECT Id, Name, TargetId, StatusCode
    FROM ActionPlan
    WHERE TargetId IN :carePlanIds
];

Set<Id> actionPlanIds = new Map<Id, ActionPlan>(actionPlans).keySet();
List<ActionPlanItem> actionPlanItems = actionPlanIds.isEmpty()
    ? new List<ActionPlanItem>()
    : [
        SELECT Id, Name, ActionPlanId, ItemId, IsRequired
        FROM ActionPlanItem
        WHERE ActionPlanId IN :actionPlanIds
    ];

Set<Id> actionPlanManagedItemIds = new Set<Id>();
for (ActionPlanItem actionPlanItem : actionPlanItems) {
    if (actionPlanItem.ItemId != null) {
        actionPlanManagedItemIds.add(actionPlanItem.ItemId);
    }
}

Set<Id> taskParentIds = new Set<Id>();
taskParentIds.addAll(carePlanIds);
taskParentIds.addAll(new Map<Id, GoalAssignment>(goalAssignments).keySet());
taskParentIds.addAll(new Map<Id, BenefitAssignment>(benefitAssignments).keySet());
taskParentIds.addAll(actionPlanIds);
taskParentIds.addAll(new Map<Id, ActionPlanItem>(actionPlanItems).keySet());

List<Task> allRelatedTasks = [
    SELECT Id, Subject, WhatId, WhoId, Status, ActivityDate
    FROM Task
    WHERE WhatId IN :taskParentIds
];

// Required Action Plan Tasks cannot be deleted directly. Deleting their Action Plan
// removes the managed ActionPlanItems and Tasks in the supported order.
List<Task> independentlyDeletableTasks = new List<Task>();
for (Task taskRecord : allRelatedTasks) {
    if (!actionPlanManagedItemIds.contains(taskRecord.Id)) {
        independentlyDeletableTasks.add(taskRecord);
    }
}

List<CarePlanDetail> carePlanDetails = [
    SELECT Id, CarePlanId, DetailRecordId
    FROM CarePlanDetail
    WHERE CarePlanId IN :carePlanIds
];

System.debug(LoggingLevel.WARN, '=== Student Care Plan deletion preview ===');
System.debug(
    LoggingLevel.WARN,
    'Source Case: ' + sourceCase.Id + ' | ' + sourceCase.CaseNumber
);
System.debug(
    LoggingLevel.WARN,
    'Student: ' + studentContactId + ' | ' + sourceCase.Contact.Name
);
System.debug(LoggingLevel.WARN, 'Care Plans across all Cases: ' + carePlansToDelete.size());
System.debug(LoggingLevel.WARN, 'All related Tasks: ' + allRelatedTasks.size());
System.debug(LoggingLevel.WARN, 'Action Plan-managed Tasks: ' + actionPlanManagedItemIds.size());
System.debug(LoggingLevel.WARN, 'Independently deletable Tasks: ' + independentlyDeletableTasks.size());
System.debug(LoggingLevel.WARN, 'Goal Assignments: ' + goalAssignments.size());
System.debug(LoggingLevel.WARN, 'Benefit Assignments: ' + benefitAssignments.size());
System.debug(LoggingLevel.WARN, 'Action Plans: ' + actionPlans.size());
System.debug(LoggingLevel.WARN, 'Action Plan Items: ' + actionPlanItems.size());
System.debug(LoggingLevel.WARN, 'Care Plan Details: ' + carePlanDetails.size());

for (CarePlan carePlanRecord : carePlansToDelete) {
    System.debug(
        LoggingLevel.WARN,
        'Care Plan: ' + carePlanRecord.Id + ' | ' + carePlanRecord.Name
            + ' | Case: ' + carePlanRecord.CaseId + ' | Status: ' + carePlanRecord.Status
    );
}

for (Task taskRecord : allRelatedTasks) {
    System.debug(
        LoggingLevel.WARN,
        'Task: ' + taskRecord.Id + ' | ' + taskRecord.Subject + ' | Parent: ' + taskRecord.WhatId
    );
}

if (!doDelete) {
    System.debug(
        LoggingLevel.WARN,
        'DRY RUN ONLY. No records were deleted. Set doDelete = true after reviewing this preview.'
    );
} else if (carePlansToDelete.isEmpty()) {
    System.debug(
        LoggingLevel.WARN,
        'No Care Plans were found for this student. No records were deleted.'
    );
} else {
    Savepoint cleanupSavepoint = Database.setSavepoint();
    try {
        // Delete Action Plans first so Salesforce removes their required managed items.
        delete actionPlans;
        // Delete only Tasks that are not managed by an Action Plan.
        delete independentlyDeletableTasks;
        // Benefit Assignments must go before Goal Assignments: a Goal Assignment
        // can't be deleted while a Benefit Assignment still references it.
        delete benefitAssignments;
        delete goalAssignments;
        delete carePlanDetails;
        delete carePlansToDelete;

        System.debug(
            LoggingLevel.WARN,
            'Deletion completed for ' + carePlansToDelete.size()
                + ' Care Plan(s) associated with student ' + studentContactId
                + '. Cases, Contact, and CaseParticipants were retained.'
        );
    } catch (Exception cleanupException) {
        Database.rollback(cleanupSavepoint);
        System.debug(LoggingLevel.ERROR, 'Deletion failed and was rolled back: ' + cleanupException.getMessage());
        throw cleanupException;
    }
}
