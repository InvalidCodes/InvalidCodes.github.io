---
title: "Does Embodied AI Need Remote Teleoperation?"
subtitle: "The economics of human intervention and the uncertain path from deployment to autonomy"
date: 2026-11-27
description: "An examination of whether long-distance human intervention is a necessary step toward commercially viable and continually improving robots."
tags: ["Embodied AI", "Robot Learning", "Teleoperation", "Shared Autonomy", "Data Flywheel"]
lang: en
---

*Overview: Remote teleoperation offers robotics companies a way to put imperfect policies to work while collecting experience from the situations in which those policies struggle. This article examines the commercial appeal of that arrangement, the conditions under which it can sustain a data flywheel, and the alternatives available to companies pursuing autonomy. The research and industry examples discussed here reflect selected work available as of November 27, 2026.*

Suppose a robotics company has built a reasonably capable machine for restocking convenience stores. Its policy can pick up bottles and put them on a shelf, provided the bottles are arranged roughly as they were during training. Then a bottle falls behind a row of cans. The robot hesitates, tries an awkward grasp, and gets stuck. A store employee could fix the problem in seconds. A human operator connected from another city could potentially do the same through the robot.

The second option is attractive for a particular reason. The store gets its shelf restocked, the robotics company gets another example of a situation its policy handles poorly, and a future software update might make the same intervention unnecessary. A business could begin operating well before its model reaches the reliability customers ultimately expect.

I find this argument compelling, especially for robots expected to work in varied physical environments. The interesting question is how much of the benefit actually comes from remote teleoperation. Human assistance, the ability to pool operators across sites, and the opportunity to learn from deployment are three distinct advantages. A company may need all three, or it may be able to obtain what it needs through a much simpler arrangement.

## 1. Why deploy an imperfect robot?

A good demonstration in a robotics lab and a reliable commercial service make very different demands on a policy. The lab can reset the scene after a failed attempt, while a customer expects the robot to finish the job. The customer also introduces variations that are difficult to anticipate during training, including unfamiliar objects, changes in lighting, and interruptions by other people. As the task grows longer, seemingly minor weaknesses begin to matter.

Consider an illustrative task with 50 sequential steps, each with an independent probability of success of 99%. If every step is required and a single failure ends the episode, the chance of completing the task is approximately

\[
P_{\mathrm{success}} = 0.99^{50} \approx 60.5\%.
\]

Real tasks have dependent failures and opportunities for recovery, so this calculation is a deliberately simplified example. It nevertheless helps explain why recovery deserves so much attention. A robot with a slightly imperfect grasping policy can be quite useful if it recognizes a bad grasp, adjusts the object, and tries again. A robot that stops working after every minor error can require an impractical amount of supervision even when its individual skills look impressive.

There is a difficult feedback loop here. A company wants deployment experience to improve its model, yet a customer may be unwilling to accept the failures that generate that experience. One way out is to constrain the task until the autonomous system is reliable enough. Another is to have a person available to recover from mistakes while the model improves.

Remote operation makes the second approach particularly interesting. It allows a company to install hardware before the intelligence behind it is fully mature. Mechanical reliability, actuator wear, sensor placement, maintenance, and integration with a customer's workflow can all be investigated during real operations. Meanwhile, the software team can work on the failure modes those operations reveal.

The hardware and the model still have a close relationship. A new gripper changes the set of achievable actions, and a relocated camera changes what the policy observes. Earlier trajectories may need to be transformed, supplemented, or collected again. Remote assistance gives the two development processes some freedom to proceed in parallel, while their eventual compatibility remains an engineering requirement.

## 2. Learning from the mistakes a robot actually makes

Much of the appeal of deployment comes from the way a robot creates its own data distribution. During ordinary imitation learning, a human demonstrates how to perform a task, and the policy learns to reproduce those actions. During execution, however, the policy can make a small error that puts it into a state rarely encountered in the demonstrations. The next action must then be generated from an unfamiliar observation, and further errors can accumulate.

This is the motivation behind DAgger, or Dataset Aggregation, which collects expert supervision on states visited by a learned policy. [^dagger] Returning to the store, a person could demonstrate a thousand successful bottle grasps in advance. A demonstration of how to retrieve a bottle after the robot has pushed it behind a can may be especially valuable to the current policy, because it addresses a specific weakness in its behavior.

Human intervention during deployment offers a practical way of obtaining this kind of supervision. A robot attempts the task, a person intervenes when needed, and the resulting experience becomes part of a training dataset. The observations leading up to the intervention help explain how the robot got into trouble. The human's actions describe a possible recovery, and the eventual outcome indicates whether that recovery worked.

The distinction between the states and the actions matters for training. States reached by the autonomous policy reflect its execution distribution, while actions taken during an intervention come from a human behavior policy. A replay buffer accumulated over several model updates also mixes experience from different policies. An appropriate learning algorithm needs to account for that mixture, particularly if it relies on assumptions about how its training trajectories were generated.

Sirius, introduced in *Robot Learning on the Job*, is a useful example of this idea. It combines human monitoring with partial robot autonomy and trains updated policies from the resulting deployment data. Its weighted imitation learning objective uses information about human interventions to change the relative contribution of different training samples. [^sirius] It shows how supervision can be integrated into the operation of the robot itself, although the system still assigns monitoring responsibilities to people.

*Learning while Deploying* extends the idea to continual reinforcement learning for a shared vision-language-action (VLA) policy. A VLA takes sensory observations and a language instruction and produces robot actions. In the LWD framework, autonomous attempts, failures, and human interventions enter a shared replay buffer used for offline and online reinforcement learning. Distributional Implicit Value Learning estimates returns from this heterogeneous experience, and Q-learning via Adjoint Matching updates the flow-based action generator. In experiments involving 16 dual-arm robots and eight manipulation tasks, the shared policy eventually reached a reported mean success rate of 95%. [^lwd]

These are encouraging results for learning from deployment. The commercial question goes a step further. If a company adds a hundred robots, does the next hundred become cheaper to operate because of what the first hundred learned?

### From a feedback loop to a flywheel

The distinction between a data loop and a data flywheel is useful here. A data loop is a pipeline: collect experience, update the model, evaluate it, and redeploy it. A flywheel exists when improvements produced by that pipeline make subsequent deployment more attractive, which in turn provides further useful experience.

```text
More deployed robots
        ↓
More useful experience from real tasks
        ↓
Better autonomous performance
        ↓
Lower operating costs and more reliable service
        ↓
More opportunities to deploy robots
```

The crucial assumption is that the experience of one robot improves other robots. A recovery learned in one convenience store should ideally help with unfamiliar bottles in another store. If every new location requires weeks of site-specific supervision, the company may have built an effective customization pipeline while retaining substantial deployment costs.

The long tail also changes as the business expands. A robot that learns to deal with overturned bottles may then be asked to handle fragile packages or clean up spilled liquid. Its aggregate intervention rate might rise simply because its assignments have become harder. Measuring progress requires repeated evaluations on comparable tasks, together with tests of generalization to new objects and environments. Keeping representative successful trajectories in the training buffer and testing previously mastered tasks can also help guard against the loss of existing skills during continual updates.

## 3. The business is ultimately about human time

A major argument for long-distance teleoperation is labor arbitrage. Physical work can take place in a high-wage market while a qualified operator assists the robot from a region with lower labor costs. Companies can also concentrate specialized operators in one center and share them across customers. Both advantages depend on the tasks being suitable for remote operation and on the relevant labor, safety, and data requirements.

I think the more interesting economic opportunity comes from sharing human attention. A person who spends an entire shift driving one robot is selling labor through a different interface. That arrangement may be worthwhile for hazardous work or locations that are difficult to staff. For ordinary retail or household chores, however, the company must recover the cost of a robot in addition to paying someone to operate it.

A partially autonomous robot changes the calculation. If it can handle routine work independently, the operator can spend the rest of the time assisting other machines. Let \(w\) be the fully loaded hourly cost of an operator, \(p\) the fraction of robot operating time that consumes human attention, and \(u\) the fraction of paid operator time available for that work. A simple average-load model gives

\[
C_{\mathrm{human}}=\frac{wp}{u},\qquad N=\frac{u}{p}.
\]

Here, \(C_{\mathrm{human}}\) is the approximate human labor cost per robot-hour, and \(N\) is the average number of simultaneously operating robots one person can support. The calculation assumes comparable robots and interchangeable operators. Using an illustrative hourly cost of $15 and an effective utilization of 70%, we obtain:

| Human attention per robot | Human cost per robot-hour | Average robots per operator |
|---|---:|---:|
| 20% | $4.29 | 3.5 |
| 5% | $1.07 | 14 |
| 2% | $0.43 | 35 |
| 1% | $0.21 | 70 |

These numbers exclude hardware, maintenance, connectivity, insurance, training, and local support. They represent average workload capacity, with actual staffing determined by how quickly assistance needs to arrive.

Imagine fourteen robots working in similar stores. A shared policy update introduces a weakness when handling a particular type of bottle, and several stores receive that product on the same morning. The resulting requests for help may arrive together. Some robots can wait safely, while others may be holding something unstable. A company needs sufficient spare capacity and local fallback behavior to handle such bursts.

Fleet-DAgger formalizes the problem of allocating limited human supervision across a collection of robots that can request help and learn from their interventions. [^fleet] It is a particularly relevant piece of research because the constraint on human attention is part of the learning problem itself. Requests differ in urgency, the time they consume, and the potential value of the resulting training data. A real service must satisfy safety and response requirements before optimizing for learning value.

There is another cost hidden inside the word intervention. An operator has to understand what the robot was doing, examine the current scene, decide what went wrong, and confirm that the robot is ready to continue. These activities can take longer than the corrective movement. A useful metric would therefore count the total human minutes required per successfully completed task, including context switching and monitoring. Counting only the occasions on which someone moves a joystick can give a misleading impression of scalability.

## 4. Would a dedicated network solve the latency problem?

A common argument is that a dedicated communication link can make long-distance teleoperation feel as smooth as local control. There is some truth to this. Predictable bandwidth, reduced congestion, low packet loss, and stable delivery times make a substantial difference to a video and control system.

Consider, though, what happens when an object starts slipping. The camera or tactile sensor first has to observe the change. The observation is encoded, transmitted, decoded, and displayed. The operator reacts, a command travels back to the robot, and the hardware executes it. A dedicated link helps with the communication stages. The other stages remain part of the physical feedback loop.

Even a perfectly provisioned network has a propagation delay. Light travels through optical fiber at roughly 200,000 kilometers per second. For an illustrative fiber route of 10,000 kilometers, propagation alone accounts for about 50 milliseconds in each direction. Actual routes, video processing, network devices, and human reaction add to that delay. This makes a global labor pool and a short control loop somewhat competing objectives.

For navigation through an empty aisle, an additional fraction of a second may be quite manageable. For a hand trying to stabilize a slipping object, a command arriving a fraction of a second later may apply to a contact state that has already changed. A 2024 study of two remote manipulation tasks motivated by space operations tested round-trip delays up to 2.6 seconds and found that increasing delay degraded several aspects of performance. Some benefits of haptic feedback also diminished with latency. [^latency] The scale of the effects in an Earth-based service would depend on its tasks and actual network conditions.

### Keep the fast feedback close to the robot

A more promising architecture uses different forms of control at different timescales. A remote operator might identify a bottle as the target, indicate its desired position, or resolve ambiguity about a task. The robot can use its local policy to plan motion, while a local controller handles position, force, collision avoidance, and other rapid feedback.

```text
Remote human assistance
        ↓  Goal, subgoal, or correction
Local motion policy
        ↓  Trajectory or action commands
Real-time controller and safety system
        ↕  Current physical feedback
Robot and environment
```

This form of shared autonomy also reduces the amount of attention required from an operator. Picking a target in an interface can be considerably faster than controlling a manipulator throughout an entire grasp. Its usefulness depends on the capabilities available locally. An unfamiliar grasp that exceeds those capabilities may still require direct remote control or assistance from someone at the site.

The robot also needs a defined response when communication is lost or assistance arrives too late. Depending on the task, this may involve stopping, maintaining a safe grasp, or executing a verified recovery maneuver. A remote operator can make the service more capable, while time-sensitive safety functions need to remain effective under realistic communication failures.

The self-driving car analogy helps clarify the difference. In the standard driving automation terminology, Level 2 requires ongoing driver supervision, whereas Level 4 assigns the driving task to the automated system within its specified operating domain. [^nhtsa] Calling assisted robots L2+ informally captures the idea of an intermediate commercial stage, although manipulation needs its own allocation of control and fallback responsibilities.

Waymo's public description of Remote Assistance is especially instructive. Operators respond to requests for information and guidance, and the automated driving system retains the authority to decide how to act. [^waymo] This is a different arrangement from a remote driver continuously steering a car. For robotics companies, the analogy suggests a continuum from direct motion control to high-level assistance. The more capable the local controller becomes, the more interesting the latter arrangement may be.

## 5. Privacy could be the harder commercial problem

Network latency has the advantage of being measurable. A company can test a connection, measure its effect on completion time, and decide whether a local controller compensates for it. Privacy and commercial confidentiality involve the interests of several parties, and the technically optimal design may be unacceptable to one of them.

Imagine having a household robot that gets stuck while clearing a table. Its camera might show children's faces, photographs, paperwork, or a conversation taking place nearby. A factory camera might expose a customer's production process, machinery layout, inventory, or unreleased products. Encryption can protect the stream in transit. The operator still needs to see enough of the scene to perform the work.

There are three activities that a robotics company needs to treat separately: live access to observations, retention of recorded observations, and reuse of those records for model training. A customer may be comfortable with a technician viewing a live feed for a few seconds and require the stream to be discarded once the task is complete. A factory may permit local recording for debugging and restrict the use of those records for a shared model serving its competitors.

Where the European Union's General Data Protection Regulation applies, processing personal data requires an applicable legal basis and compliance with requirements such as purpose limitation, data minimization, and storage limitation. Transfers to other countries bring additional requirements under Chapter V. [^gdpr] Industrial confidentiality also raises contractual and trade secret concerns beyond personal data protection. The appropriate arrangement will vary with the jurisdiction, the parties, and the information being processed.

This is a particularly important distinction for a company whose valuation depends on a data flywheel. Its accessible training dataset may be much smaller than the volume of data passing through its robots. It may be profitable to provide a service to a particular customer while gaining very little reusable learning experience from that customer.

Public commercial spaces sometimes seem like an obvious starting point. A robot can work in a shopping center, a hotel, or a transportation hub without entering someone's home. Those sites can nevertheless contain identifiable people and sensitive operational areas. A controlled stockroom with a narrowly defined task might be a better first deployment than a busy public lobby.

Telexistence offers a concrete example. Its TX SCARA system was designed for beverage replenishment in the back areas of convenience stores, with remote control available when autonomous replenishment failed. In August 2022, Telexistence and FamilyMart announced a plan to install the system in 300 stores. [^tx-system] [^tx-rollout] The choice of task and setting is interesting in its own right. The work is repetitive, the range of objects is relatively predictable, and the robot can operate in a more controlled space than a general household assistant. The announcement establishes a commercial deployment initiative, while the long-term economics and cross-customer learning benefits require separate evidence.

### How much of the scene does a remote operator really need?

One possible research direction is to change the information interface itself. A robot could construct a local semantic map, send object poses and geometry, or provide a digital twin of the relevant workspace. Faces and text could be obscured where they are irrelevant to a task. A customer could also keep the whole assistance system inside its own facility, at the cost of limiting the global labor pool and potentially the amount of experience shared across clients.

The hard part of transmitting a compact scene representation is that an intervention often starts precisely because the model has misunderstood something. If a perception system fails to recognize a transparent object or an unfamiliar tool, the representation it generates may hide the very information an operator needs. A geometric reconstruction can also reveal sensitive details about a room or a manufacturing process. Learned features can retain information about their original inputs.

Privacy-preserving teleoperation therefore presents a genuine research tradeoff. An experiment could compare authorized raw video, masked video, and task-specific reconstructions under unfamiliar conditions. Recovery success, human time, bandwidth, and measured disclosure risk would together reveal how much information is actually necessary for useful remote assistance.

## 6. Could robots learn and deploy without remote intervention?

The strongest argument against treating remote teleoperation as an inevitable stage is that there are several ways to obtain experience and several ways to deliver reliable service. Which combination makes sense depends on the nature of the task.

A robot can learn through autonomous exploration when failures are relatively inexpensive and success can be detected reliably. QT-Opt, for example, used more than 580,000 real-world grasp attempts in a self-supervised reinforcement learning framework. The reported grasp success rate on unseen objects was 96%, and the learned behavior included regrasping and responding to disturbances. [^qtopt] For an isolated grasping setup, automatically obtaining such experience can be much easier than for an open-ended household task, where defining success, resetting the scene, and preventing damage all become more difficult.

Simulation provides another way to gather physical interaction experience. *Learning Dexterous In-Hand Manipulation* demonstrated a policy trained entirely in simulation and transferred to a physical dexterous hand for object reorientation. Domain randomization varied properties of the simulated system to improve transfer. [^dexterity] The approach is particularly appealing where contact dynamics and task conditions can be represented adequately. The expense of modeling unfamiliar materials and diverse real environments helps determine how much additional real-world experience will be needed.

A deployed robot can also generate learning data autonomously. The 2025 study *Robot-Powered Data Flywheels* deployed a mobile manipulator in a library for two weeks. The robot scanned shelves and used the library catalog to generate labels for its observations. Fine-tuning the vision-language model on that experience improved book identification from 32.0% to 71.8% in the studied library setting. [^scanford] The result concerns visual recognition, a different problem from continually learning a manipulation policy. It illustrates how the environment can provide its own source of supervision when it has suitable structure.

Finally, some customers already have people at the site. A warehouse worker may be able to recover a stuck robot or reset a work cell faster than a remote operator could understand the situation. Local assistance can simplify communication and data governance. Centralized remote assistance becomes more attractive when those exceptions are infrequent enough to make sharing a pool of operators across sites economically valuable.

The alternatives are also compatible. A robotics company could train a policy in simulation, collect autonomous experience on a controlled test fleet, deploy it in carefully selected workplaces, and use remote intervention only for the exceptions that justify its cost. The decision about whether to install teleoperation belongs alongside these other choices about deployment and learning.

## 7. What would convince me that this route works?

The appealing vision is a fleet whose human supervision requirements fall as it accumulates experience. A rigorous demonstration would need to separate the value of human supervision from the particular value of providing that supervision remotely. I would compare robots with autonomous recovery, robots with on-site human assistance, and robots with access to a shared remote operator pool. The starting model, hardware, tasks, and operating conditions should be comparable, and an additional fixed-policy baseline would help measure the benefit of learning during deployment.

The study would need to track ordinary task success and recovery success, along with human minutes per successful task, response-time distributions, and total cost per successful task. It should account for monitoring, operator training, software infrastructure, communication, and local fallback mechanisms. Separate learning comparisons at a matched human supervision budget would help establish whether intervention data offers better learning efficiency than conventional demonstrations or autonomous exploration.

I would also test the same fleet on unfamiliar objects and new sites after several rounds of updates. A sustained drop in human assistance on comparable tasks is useful evidence of learning. A drop that carries over to unfamiliar settings makes a much stronger case for the flywheel. Testing earlier tasks after every update would reveal whether recent learning comes at the expense of previously reliable skills.

There is room for research at the intersection of these problems. A policy could estimate when it is likely to fail and request assistance before entering an expensive recovery state. An interface could let the operator choose between a high-level goal and a more direct corrective action. A fleet scheduler could assign requests according to their safety requirements and expected service time, using remaining capacity for particularly informative interventions. Fleet-DAgger, Sirius, and LWD provide concrete precedents for investigating those components. Their integration with real operating costs, restricted data permissions, and generalization across sites is the particular question I would want to investigate further.

## 8. Is remote teleoperation a necessary step?

For a company trying to sell robots before its generalist policy is ready, on-demand remote assistance may be a very sensible way to get started. It can provide immediate value to the customer, expose hardware to realistic use, and generate experience from genuine failures. The ability to share a geographically distributed workforce gives it an advantage over simply stationing a technician beside every robot.

I would be much more cautious about building the entire business around the assumption that human corrections will eventually solve the long tail. That assumption depends on how well robot learning generalizes, how efficiently the fleet can use human attention, and how much of the operating data the company is allowed to reuse. More deployments can expose more weaknesses just as easily as they can provide evidence for overcoming them.

For the convenience store, the first intervention might be worth paying for simply because it gets the shelf restocked. The learning opportunity becomes much more valuable if the next robot, in a different store with a different shelf, can recover from a similar failure without calling anyone. Over time, a service built around that kind of transferable improvement could become substantially cheaper to deliver.

That is why I see remote teleoperation as a plausible bridge to autonomy, particularly for certain commercial tasks. The strength of the case depends on whether crossing that bridge is faster and less expensive than the available alternatives. The most interesting measure of its success will be how little of it the robots eventually need.

## References and version notes

[^dagger]: Ross, Gordon, and Bagnell. *A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning*. AISTATS 2011, PMLR 15:627-635. https://proceedings.mlr.press/v15/ross11a.html

[^sirius]: Liu et al. *Robot learning on the job: Human-in-the-loop autonomy and learning during deployment*. The International Journal of Robotics Research, first published online October 23, 2024. DOI: 10.1177/02783649241273901. Introduces Sirius and its weighted imitation learning and deployment framework. https://doi.org/10.1177/02783649241273901

[^lwd]: Wang et al. *Learning while Deploying: Fleet-Scale Reinforcement Learning for Generalist Robot Policies*. arXiv:2605.00416, first submitted May 1, 2026. The cited 95% mean success rate refers to the reported eight-task evaluation using a fleet of 16 dual-arm robots. https://arxiv.org/abs/2605.00416

[^fleet]: Hoque et al. *Fleet-DAgger: Interactive Robot Fleet Learning with Scalable Human Supervision*. Sixth Conference on Robot Learning, PMLR 205:368-380, 2023 proceedings. https://proceedings.mlr.press/v205/hoque23a.html

[^latency]: *Impact of Haptic Feedback in High Latency Teleoperation for Space Applications*. ACM Transactions on Human-Robot Interaction, 13(2), June 2024. DOI: 10.1145/3651993. The study used two tasks and round-trip delays of up to 2.6 seconds. https://doi.org/10.1145/3651993

[^nhtsa]: National Highway Traffic Safety Administration. *Automated Vehicle Safety*. Descriptions of Level 2 and Level 4 driving automation. https://www.nhtsa.gov/vehicle-safety/automated-vehicle-safety

[^waymo]: Waymo. *Advice, not control: the role of Remote Assistance in Waymo's operations*. February 17, 2026. The company's explanation of how remote agents provide guidance to its automated driving system. https://waymo.com/blog/shorts/advice-not-control-the-role-of-remote-assistance/

[^gdpr]: European Union. Regulation (EU) 2016/679, General Data Protection Regulation. See Articles 5 and 6 and Chapter V. https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/

[^tx-system]: Telexistence. *Telexistence develops a new robot TX SCARA and installs it at FamilyMart METI Store*. November 2, 2021. Describes autonomous beverage restocking with remote control for recovery. https://tx-inc.com/en/blog/2021/11/02/11451/

[^tx-rollout]: Telexistence and FamilyMart. Joint announcement of TX SCARA installation in 300 FamilyMart stores, August 10, 2022. https://tx-inc.com/en/blog/2022/08/10/11737/

[^qtopt]: Kalashnikov et al. *QT-Opt: Scalable Deep Reinforcement Learning for Vision-Based Robotic Manipulation*. CoRL 2018. arXiv:1806.10293. https://research.google/pubs/qt-opt-scalable-deep-reinforcement-learning-for-vision-based-robotic-manipulation/

[^dexterity]: Andrychowicz et al. *Learning Dexterous In-Hand Manipulation*. arXiv:1808.00177, August 2018. https://arxiv.org/abs/1808.00177

[^scanford]: Grannen et al. *Robot-Powered Data Flywheels: Deploying Robots in the Wild for Continual Data Collection and Foundation Model Adaptation*. arXiv:2511.19647, first submitted November 24, 2025. The cited improvement concerns book identification in the studied library. https://arxiv.org/abs/2511.19647
