/**
 * WorkbookRenderer - Renders structured workbook components from JSON data
 * This is the core engine that takes an array of component definitions
 * and renders the appropriate UI component for each one.
 */

import React from 'react';
import {
  SectionHeader,
  SubHeader,
  BodyBlock,
  PrincipleCard,
  FlashcardSet,
  ScenarioDrill,
  InteractiveCoach,
  FlowDiagram,
  ConceptMap,
  WorkflowOverlay,
  ReflectionBlock,
  SelfAssessmentScale,
  QuizBlock,
  FieldChallenge,
  Divider,
} from './index';

const COMPONENT_MAP = {
  SectionHeader,
  SubHeader,
  BodyBlock,
  PrincipleCard,
  FlashcardSet,
  ScenarioDrill,
  InteractiveCoach,
  FlowDiagram,
  ConceptMap,
  WorkflowOverlay,
  ReflectionBlock,
  SelfAssessmentScale,
  QuizBlock,
  FieldChallenge,
  Divider,
};

const WorkbookRenderer = ({ components }) => {
  if (!components || components.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <p className="text-lg">No workbook content available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {components.map((component, index) => {
        const Component = COMPONENT_MAP[component.component_type];

        if (!Component) {
          console.warn(`Unknown workbook component type: ${component.component_type}`);
          return null;
        }

        return <Component key={index} data={component} />;
      })}
    </div>
  );
};

export default WorkbookRenderer;
