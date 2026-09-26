---
title: After the Robot Brain
subtitle: Why Agentic Robotics Does Not Make VLA Obsolete, and Why Its Role Is Becoming Clearer
date: 2026-09-27
description: Agentic robotics is not replacing vision language action models. It is clarifying their job as the physical intelligence layer that turns intent into reliable action.
tags: [Robot Learning, VLA, Agentic]
lang: en
---

# After the Robot Brain

## 1. The question sounds like a competition

Imagine a household robot that receives one instruction:

> Clean the kitchen.

A few years ago, the dream was easy to describe. Build one large model that sees the room, understands the sentence, decides what to do, and directly outputs robot actions.

That dream helped make the **vision language action model**, or **VLA**, one of the central ideas in modern robot learning. A VLA takes visual observations and language as input, then produces actions. Physical Intelligence's original π₀ was a representative example of this generalist direction. It was presented as a model that could control different robot types and directly output low level motor commands from multimodal input. [^pi0]

Then Agentic Robotics became increasingly visible.

Now the robot is no longer imagined as one model that does everything. Instead, people talk about planning, memory, tool use, verification, recovery, world models, and specialized skills.

That creates an obvious question:

**If the robot now has an Agent, what is left for the VLA to do?**

The tempting answer is that VLA is being replaced.

That answer is too simple.

What is actually happening is more interesting. VLA is moving from being imagined as the entire robot brain toward becoming the physical intelligence layer that turns intent into reliable action. In some systems it becomes a downstream controller. In others it becomes a callable skill. In still others, agentic abilities are being folded back into the VLA itself.

The role is changing, but the role is also becoming easier to define.

## 2. Why a single VLA is not enough for a long task

Suppose our robot already knows how to pick up a plate, open a drawer, wipe a surface, and place an object.

That still does not mean it knows how to clean a kitchen.

The long task contains a different set of problems.

The robot must remember what it has already cleaned. It must decide which object matters next. It must notice when a grasp failed. It must change the plan when a cup is not where it expected. It may need to retry, skip a step, or choose another strategy.

These problems are not simply harder versions of motor control.

They are problems of **task state, planning, memory, verification, and recovery**.

A useful first abstraction is therefore:

```text
User instruction
      ↓
Agent or planner
      ↓
subtask
      ↓
VLA policy
      ↓
robot action
```

The Agent answers a question such as:

> What should I do next?

The VLA answers a different question:

> Given this intended physical subtask and what I currently see, how should I move?

This distinction is not perfect. Modern VLAs can contain reasoning, and modern agents can use geometry and control tools. But it explains why Agentic Robotics does not automatically remove the need for VLA.

Long-horizon reasoning and contact-rich control are different bottlenecks.

## 3. π₀.₇ was already pointing toward this split

π₀.₇ was released by Physical Intelligence on April 16, 2026, only about five months before this literature snapshot. It is therefore not an old model in calendar time. [^pi07]

What makes it important for this discussion is not merely that it is a stronger VLA.

Its deeper idea is **steerability**.

Instead of conditioning only on a broad language instruction, π₀.₇ can use richer context about how a task should be performed. Its prompting framework can include language that describes subtasks, metadata such as speed or quality, control modality labels, and visual subgoals that show a desired future state. At test time, visual subgoals can even be produced by a lightweight world model. [^pi07]

That changes the role of the policy.

A simple VLA interface looks like this:

```text
"Put the cup in the drawer"
            ↓
           VLA
            ↓
        robot motion
```

A steerable action model can receive something richer:

```text
task instruction
+
current subtask
+
visual subgoal
+
strategy information
+
control context
        ↓
       VLA
        ↓
    robot motion
```

This is a crucial step toward Agentic Robotics because an upper layer now has more ways to tell the action model what it means.

π₀.₇ even demonstrates a high level policy that generates language subtasks for an air fryer task, while a world model provides subgoal images that condition the VLA. Its final discussion also points toward future systems that reason about possible strategies, ground those thoughts into actions, observe the outcome, and revise the plan. [^pi07]

So π₀.₇ should not be read as the final answer to Agentic Robotics.

It is better understood as an action model becoming easier for an Agent to steer.

## 4. The real frontier is the interface

Once we accept a hierarchy, a harder question appears.

What exactly should travel from the Agent to the VLA?

Language is the simplest answer:

```text
Agent → "pick up the blue cup" → VLA
```

But language can be underspecified.

It may not say where to grasp. It may not say which side to approach from. It may not specify the desired final pose. It may not express a temporary motion constraint that matters for the next two seconds.

This turns the interface itself into a research problem.

A September 2026 paper called **2AM** makes this unusually explicit. Its Agent holds the task memory, while the Action Model is episodically stateless. The Agent converts its memory into subtask language and optional two dimensional grasp, place, and move hints. The VLA is trained to respond to these hints even when they are imperfect. [^2am]

The important idea is larger than one architecture.

**Memory does not necessarily need to live inside the action policy.**

An Agent may remember the episode, reason about progress, and communicate only the information the VLA needs right now.

This suggests a broader interface vocabulary:

```text
Agent memory
    ↓
language subgoal
visual target
grasp hint
place hint
motion hint
strategy
    ↓
VLA
```

The research question is no longer just whether the system should be hierarchical.

It becomes:

**How much information must cross the boundary for the lower policy to behave as the upper Agent intends?**

## 5. A hierarchy is not automatically better

Once hierarchical systems became popular, another problem appeared.

People could combine a VLM planner and a VLA controller in many different ways, but there was no guarantee that the hierarchy itself was well designed.

A June 2026 study on hierarchical VLA agents examined choices such as the planner, the controller, the mechanism that switches between them, the observation representation, and the memory representation. Its main lesson is that system design matters. A carefully designed hierarchy can outperform both flat VLA control and a naive hierarchy, but simply adding a planner above a VLA is not enough. [^hivla]

This matters because "Agent plus VLA" can hide many different systems.

For example:

```text
Agent plans once
      ↓
VLA executes for a long time
```

is very different from:

```text
Agent checks progress
      ↓
VLA executes a bounded subtask
      ↓
Agent receives new evidence
      ↓
Agent replans
```

The second system creates a closed loop at the task level.

The key question is not whether there are two models.

The key question is how information, responsibility, and control are divided between them.

## 6. VLA can become a physical skill API

There is an even more modular interpretation.

Instead of one Agent calling one VLA, imagine an Agent choosing among several physical skills.

```text
                 ┌→ general VLA
                 │
Agent or router ─┼→ dexterous VLA
                 │
                 ├→ RL policy
                 │
                 └→ task and motion planner
```

This is close to the idea behind **VLAs as Tools**, which assigns global reasoning and recovery to a high level VLM agent while specialized VLA tools execute bounded physical operations. The interface also returns execution progress so the Agent can decide when replanning is needed. [^vlastools]

**RoboHarness** pushes the same modular idea further. It treats heterogeneous robot policies as reusable agentic skills and studies how to route among VLAs, reinforcement learning policies, and task and motion planning systems while handling the difficult transitions between them. [^roboharness]

This changes the status of VLA in a subtle way.

VLA is no longer required to be the whole robot.

But it can become something equally important:

**a general physical skill that an intelligent system knows how to call.**

The analogy to software agents is useful. A software Agent may call search, code execution, or a database. A robot Agent may call a VLA, a navigation policy, a motion planner, or a specialized controller.

The analogy stops being literal because physical execution has continuous dynamics and safety constraints. Still, it captures the architectural change.

## 7. World models add another layer

Long tasks do not only require memory.

Sometimes the robot must reason about consequences.

Suppose the Agent considers two ways to clear a crowded counter. It may want to know which option is likely to produce a useful future state before committing to one.

This is where a world model can enter the hierarchy.

```text
Agent
  ↓
candidate subtask
  ↓
World model
  ↓
predicted consequence
  ↓
Agent selects
  ↓
VLA executes
```

τ₀-VLA, released in the summer of 2026, is a clear example. It uses a memory-augmented high level policy to propose the next subtask. When additional reasoning is useful, a world model can support test-time search over alternatives. A generalist low level VLA then executes the selected subtask. [^tau0]

This makes an important distinction visible.

The Agent decides what should happen next.

The world model helps reason about what might happen.

The VLA makes something happen in the physical world.

Again, these roles do not have to remain separate forever. But separating them helps us understand the computational problem.

## 8. The opposite trend is happening too

So far, the story sounds like VLA is being pushed downward into a modular stack.

But 2026 also shows the opposite movement.

Some researchers are trying to make the VLA itself more agentic.

**ART** adds on-the-fly tool use to VLA models, allowing the model to invoke external modules for perception, affordance, or embodiment support. The point is not to place a completely separate Agent above the VLA. The VLA itself becomes capable of deciding when tools should help its action generation. [^art]

**G0.5** goes further in another direction. Instead of using a pretrained VLM mainly as a context encoder plus a separate flow-matching action expert, it uses one autoregressive transformer stream for both reasoning and action tokens. Its reasoning stream includes task decomposition, grounding, and action hints, while the same model also produces the robot actions. [^g05]

This creates a second possible future:

```text
reason
  ↓
ground
  ↓
act
  ↓
observe
  ↓
reason again
```

inside a more unified model.

So there are at least two broad research directions.

One direction separates responsibilities more cleanly.

```text
Agent + world model + VLA tools
```

The other direction tries to reunify them.

```text
Agentic VLA
```

Neither has fully won.

That is exactly why the field is interesting.

## 9. What changed between April and September 2026

This also explains why π₀.₇ can feel older than five months.

The model itself is recent. The research question has simply moved very fast.

In April, a central question was:

> How can one generalist VLA become more compositional and steerable?

π₀.₇ gave a strong answer through diverse prompting, visual subgoals, and broader conditioning. [^pi07]

By the summer, the question became:

> How should a planner and an action model divide the work?

Hierarchical VLA studies, VLAs as Tools, RoboHarness, and τ₀-VLA pushed this direction. [^hivla] [^vlastools] [^roboharness] [^tau0]

By August and September, an even sharper question appeared:

> What should the interface contain, who should own memory, when should the system invoke tools or a world model, and should reasoning remain outside the action model at all?

2AM, ART, and G0.5 are different answers to that question. [^2am] [^art] [^g05]

This is why saying only that "VLA becomes the downstream part of a hierarchy" is directionally correct but incomplete.

The hierarchy itself is now the research object.

## 10. VLA has less territory, but a clearer job

Return to the kitchen robot.

An end-to-end dream asks one model to clean the entire kitchen.

The emerging agentic view asks a system to keep track of the task, decide what matters next, predict consequences when necessary, call the right physical skill, observe what actually happened, and recover from mistakes.

Where does VLA fit?

It still owns one of the hardest bridges in robotics:

**turning semantic intent into high dimensional, continuous, contact-rich physical behavior.**

That role may be narrower than "the whole robot brain."

But narrower does not mean less important.

In fact, the narrower definition makes it easier to see what a good VLA should optimize for. It should be controllable by an upper layer. It should follow bounded physical intents precisely. It should expose useful progress or failure signals. It should work across tasks and embodiments. It may need to accept language, visual goals, geometric hints, or richer forms of guidance.

Physical Intelligence described a related vision in February 2026 as a **physical intelligence layer**, something robotics applications could build on rather than rebuilding the entire intelligence stack for every robot. [^pilayer]

That framing now looks increasingly natural.

The most interesting question is therefore not:

> Will Agentic Robotics replace VLA?

A better question is:

> **What is the right contract between reasoning and acting?**

If the upper layer knows the task, remembers the past, and imagines possible futures, what must it tell the action model?

If the action model fails, what must it tell the Agent?

Should there be one general VLA or a family of physical skills?

When should a world model be consulted?

And eventually, should these modules remain separate, or should reasoning and action collapse back into one model?

Those questions are more precise than the original competition between Agentic Robotics and VLA.

They also reveal the larger shift.

VLA is not disappearing.

It is being repositioned from a claim about the entire robot intelligence stack into a foundation for physical execution, while Agentic Robotics studies how that physical intelligence should be organized, instructed, remembered, checked, and combined.

The field has not moved beyond VLA.

It has started asking what VLA is actually for.

## References and version notes

[^pi0]: Physical Intelligence, *π₀: Our First Generalist Policy*. Published October 31, 2024. <https://www.pi.website/blog/pi0>. Supports the description of π₀ as a generalist multimodal robot policy that directly outputs low level actions.

[^pi07]: Physical Intelligence, *π₀.₇: a Steerable Model with Emergent Capabilities*. Published April 16, 2026. <https://www.pi.website/blog/pi07>. Supports the descriptions of multimodal conditioning, language coaching, visual subgoals, high level subtask generation, and the proposed reasoning and reflection direction.

[^2am]: *2AM: Grounding Agent-Side Memory as Guidance for Steerable Action Models in Long-Horizon Manipulation*. [arXiv:2609.11308](https://arxiv.org/abs/2609.11308). First submitted September 10, 2026. Supports the separation of Agent-side task memory from an episodically stateless Action Model and the use of language plus spatial hints.

[^hivla]: *What Matters in Orchestrating Robot Policies: A Systematic Study of Hierarchical VLA Agents*. [arXiv:2606.10267](https://arxiv.org/abs/2606.10267). First submitted June 9, 2026. Supports the discussion of planner, controller, switching, observation, and memory design choices in hierarchical VLA systems.

[^vlastools]: *Towards Long-horizon Embodied Agents with Tool-Aligned Vision-Language-Action Models*. [arXiv:2605.13119](https://arxiv.org/abs/2605.13119). First submitted May 13, 2026. Supports the VLAs-as-Tools framing and progress-aware replanning interface.

[^roboharness]: *RoboHarness: Memory-Driven Orchestration of Heterogeneous Robot Policies for Long-Horizon Planning*. [arXiv:2607.18060](https://arxiv.org/abs/2607.18060). First submitted July 20, 2026. Supports the orchestration of VLAs, reinforcement learning policies, and task and motion planning systems as reusable agentic skills.

[^tau0]: *τ₀-VLA: a Hierarchical Robot Foundation Model with World-Model-Guided Test-Time Computation*. [arXiv:2608.16885](https://arxiv.org/abs/2608.16885). 2026. Project release dated July 27, 2026. <https://tau0-vla.github.io/>. Supports the memory-augmented high level policy, world-model-guided search, and generalist low level VLA architecture.

[^art]: *Evolve Vision-Language-Action Model into an Agent with On-the-fly Tool-use*. [arXiv:2608.14047](https://arxiv.org/abs/2608.14047). First submitted August 14, 2026. Supports the ART framework for adding agentic tool use to VLA models.

[^g05]: *G0.5: One Autoregressive Stream for Robot Reasoning and Action*. [arXiv:2608.11739](https://arxiv.org/abs/2608.11739). First submitted August 12, 2026. Supports the unified autoregressive stream that interleaves reasoning related tokens and robot action tokens.

[^pilayer]: Physical Intelligence, *The Physical Intelligence Layer*. Published February 24, 2026. <https://www.pi.website/blog/partner>. Supports the analogy between general purpose robot foundation models and an intelligence layer that robotics applications can build on.
