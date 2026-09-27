---
title: Embodied AI Engineering Interview Handbook
subtitle: A Bilingual Q&A on VLA Fundamentals, Representation, Action Generation, RL Post-Training, Sim2Real, and Deployment
date: 2026-09-25
description: An English and Chinese interview review guide for embodied AI and VLA roles, from observation and action tokenizers to RL post-training, Sim2Real, control, and scenario questions.
tags: [Interview, VLA, RL]
lang: en
---

# Embodied AI Engineering Interview Handbook

*This guide consolidates VLA interview notes and their follow-up clarifications. It is designed for fast interview review. Each answer starts with the core idea, then gives only the details needed to explain the mechanism clearly. Paper-specific method descriptions are cited to primary sources.*

## 1. English Edition: VLA Fundamentals

#### Q1. What is the main difference between a VLA and a standard LLM?

**Core answer:** An LLM predicts language tokens. A VLA maps visual observations, language instructions, and often robot state into executable robot actions.

Typical VLA inputs include RGB or depth images, language instructions, proprioception such as joint angles or end-effector pose, and sometimes observation or action history. Outputs can be discrete action tokens, continuous actions, action chunks, target end-effector poses, or joint commands.

A useful mental model is:

\[
\text{Vision + Language + Robot State} \rightarrow \text{Action}
\]

The vision-language backbone supplies semantic understanding, while robot training connects that understanding to physical control.

#### Q2. What is an observation tokenizer?

**Core answer:** It converts raw observations into representations that a Transformer or policy network can process.

For images, modern VLAs commonly use a vision encoder such as ViT, SigLIP, or DINO to turn image patches into continuous visual tokens. Robot state can pass through an MLP and become state tokens. These tokens are then combined with language tokens.

Modern VLA observation processing often uses continuous embeddings. Discrete k-means style tokenization is one optional design.

#### Q3. What is an action tokenizer?

**Core answer:** It converts robot actions into a representation that the policy can predict.

Three common choices are:

- **Action binning:** Split each continuous action dimension into discrete intervals and predict a class or token.
- **Learned tokenization:** Use a learned codebook, for example a VQ style representation.
- **Continuous action modeling:** Predict real-valued actions directly, often with an MLP, diffusion model, or flow model.

The choice determines the output space, training objective, precision, and generation mechanism.

#### Q4. What exactly is a bin in action binning?

**Core answer:** A bin is one interval of a continuous action range.

Suppose one action dimension satisfies:

\[
a \in [-1,1]
\]

If we use four bins, the range can be divided into four intervals:

\[
[-1,-0.5),\ [-0.5,0),\ [0,0.5),\ [0.5,1]
\]

A value such as \(0.37\) falls into the third interval, so the model predicts the corresponding bin ID. The ID can then be converted back to a representative continuous value.

With \(N\) uniformly spaced bins:

\[
\text{bin width}=
\frac{a_{\max}-a_{\min}}{N}
\]

More bins give finer resolution and smaller quantization error. They also create a larger classification space. In a multidimensional action, each dimension can be discretized separately.

#### Q5. Are discrete and continuous actions two different physical actions?

**Core answer:** They are usually two representations of the same physical control command.

A physical displacement such as \(1.2\) cm can be represented as a discrete token and later dequantized, or predicted directly as a continuous number. Discrete actions make it easy to reuse language-model classification and autoregressive decoding. Continuous actions preserve fine numerical precision and work naturally with regression, diffusion, and flow matching.

A hierarchical system can also use both. A high-level policy may choose a discrete skill such as `GRASP`, while a low-level policy produces continuous end-effector or joint commands.

## 2. English Edition: Visual and Multimodal Representation

#### Q6. How do CLIP, DINO, and SigLIP differ for robotics?

**Core answer:** They emphasize different kinds of visual information.

- **CLIP:** Strong image-text semantic alignment and open-vocabulary recognition. Its pretraining objective emphasizes semantics more strongly than fine geometric detail.
- **DINO or DINOv2:** Strong self-supervised visual structure, local correspondence, and object-centric features. Language alignment usually requires an additional projection or multimodal training stage.
- **SigLIP:** Strong image-text alignment with a sigmoid-based objective and good scalability.

For manipulation, semantic understanding and geometric precision both matter. Many modern systems therefore combine semantic and geometric features. OpenVLA, for example, fuses pretrained DINOv2 and SigLIP visual features with a Llama 2 language model. [^openvla]

#### Q7. What is the difference between an MLP projection and a Perceiver Resampler?

**Core answer:** An MLP projection mainly aligns feature dimensions. A Perceiver Resampler can align features and compress many visual tokens into a smaller fixed set.

An MLP applies a mapping such as:

\[
z_i^{vision} \rightarrow \mathrm{MLP} \rightarrow z_i^{LLM}
\]

The token count usually stays similar.

A Perceiver-style resampler uses learnable queries with cross-attention:

\[
Q \xrightarrow{\text{cross-attention}} \text{Visual Tokens}
\]

For example, hundreds of visual tokens can be compressed into dozens of latent tokens. This reduces context length at the cost of extra attention computation.

#### Q8. How do you handle token explosion from high-resolution images?

**Core answer:** Reduce redundant visual tokens while preserving task-relevant detail.

If image size is \(H \times W\) and patch size is \(P\), a ViT produces roughly:

\[
N=\frac{H}{P}\frac{W}{P}
\]

Doubling both image dimensions produces about four times as many tokens.

Common solutions include larger patches, token pooling, token merging, Perceiver-style resampling, region-of-interest selection, and multiscale features. A practical design can keep a low-resolution global view for semantics and retain high-resolution local features around the gripper or target object.

#### Q9. How can a ViT preserve low-level geometric information?

**Core answer:** Fuse information from multiple feature levels and add geometry-aware supervision.

Shallow features contain edges, texture, and local spatial detail. Deeper features contain stronger semantics and global context. A policy can fuse several layers:

\[
F=\mathrm{Fuse}(F_{early},F_{middle},F_{late})
\]

Auxiliary tasks such as depth estimation, optical flow, segmentation, 3D reconstruction, or correspondence can encourage the representation to retain geometry useful for control.

#### Q10. Where should cross-attention be inserted?

**Core answer:** The placement trades computation against how continuously visual information influences language or policy features.

- **Early fusion:** Inject visual information near the input. It is efficient.
- **Interleaved cross-attention:** Inject vision every few layers. This provides repeated visual access.
- **Dense fusion:** Use cross-modal interaction in many layers. It provides strong interaction at higher cost.

The right choice depends on latency, model size, task complexity, and how much fine visual grounding the policy needs.

#### Q11. How do you fuse multiple camera views?

**Core answer:** Encode each view, identify its camera geometry, then fuse the resulting features.

A simple pipeline is:

\[
Camera_i \rightarrow Encoder \rightarrow Tokens_i
\]

Then concatenate view tokens and add camera ID or pose information. Camera intrinsics and extrinsics help the model learn how views relate geometrically.

A more geometry-aware system can first project image features into a shared 3D representation and then fuse them there.

#### Q12. How do language instructions align with local visual details?

**Core answer:** Self-attention models language relationships, while cross-modal attention or grounding mechanisms connect language entities to visual regions.

For the instruction "pick up the red cup next to the plate and place it inside the drawer," the system needs associations such as:

\[
\text{red cup} \leftrightarrow \text{image region}
\]

and

\[
\text{drawer} \leftrightarrow \text{image region}
\]

Object queries, region features, segmentation supervision, and object-centric representations can strengthen this grounding.

#### Q13. How should a VLA handle ambiguous references such as "put this on that"?

**Core answer:** Use visual context, temporal history, and referential grounding to identify the intended objects.

Useful mechanisms include joint visual-language attention, object detection or segmentation, tracking, and temporal context. A deployed system can also request clarification when visual evidence leaves several plausible interpretations.

## 3. English Edition: Action Representation and Generation

#### Q14. How do you choose between discrete action tokens and continuous regression?

**Core answer:** Choose based on precision, multimodality, latency, and compatibility with the backbone.

Discrete actions turn prediction into classification:

\[
a \rightarrow \mathrm{bin}(a) \rightarrow \mathrm{token}
\]

They integrate naturally with LLM output heads and cross-entropy training, while introducing quantization error.

Continuous actions keep the native real-valued control space:

\[
z \rightarrow \mathrm{Action\ Head} \rightarrow a
\]

They preserve precision. A simple MSE regressor can average incompatible action modes, so multimodal tasks often benefit from diffusion or flow-based continuous generators.

#### Q15. Why are Euler angles difficult for neural robot policies?

**Core answer:** Euler angles contain singularities, discontinuities, and convention dependence.

First, **gimbal lock** occurs at specific orientations. Two rotation axes become aligned, so the parameterization locally loses an independent rotational degree of freedom.

Second, angles wrap around. \(179^\circ\) and \(-179^\circ\) are physically only \(2^\circ\) apart, while a naive Euclidean loss sees a difference of \(358^\circ\). This makes the target space discontinuous for regression.

Third, Euler angles depend on rotation order. XYZ and ZYX conventions describe rotations differently.

These issues are important because a smooth physical trajectory can appear numerically discontinuous to the network.

#### Q16. Euler angles, quaternions, or 6D rotation representation?

**Core answer:** 6D rotation representations are often attractive for learning because they give a continuous Euclidean representation of 3D rotation.

- **Euler angles:** Compact with three parameters. Their main limitations are gimbal lock and discontinuities.
- **Quaternions:** Four parameters and free of gimbal lock. The pair \(q\) and \(-q\) represents the same rotation, and normalization is required.
- **6D representation:** Predict two 3D vectors and orthogonalize them to recover a rotation matrix.

A common construction is:

\[
b_1=\frac{a_1}{\|a_1\|}
\]

\[
b_2=
\frac{a_2-(b_1^\top a_2)b_1}
{\|a_2-(b_1^\top a_2)b_1\|}
\]

\[
b_3=b_1\times b_2
\]

Then:

\[
R=[b_1,b_2,b_3]
\]

Zhou et al. showed that 3D rotations admit continuous 5D and 6D representations that are better suited to neural learning than common low-dimensional alternatives. [^rotation6d]

#### Q17. What is an autoregressive action policy?

**Core answer:** It factorizes an action sequence into sequential conditional predictions.

\[
P(a_1,\ldots,a_T|o)
=
\prod_t P(a_t|a_{<t},o)
\]

Advantages include architectural simplicity and direct reuse of Transformer decoding. The main limitation is sequential dependence. Errors in early predictions can influence later predictions, and token-by-token decoding adds latency.

OpenVLA uses autoregressive prediction over discretized action tokens. [^openvla]

#### Q18. Is ACT an autoregressive policy?

**Core answer:** ACT is best understood through action chunking.

Action Chunking with Transformers predicts a sequence of future actions as a chunk and uses a conditional variational autoencoder formulation to model demonstration variability. Its central idea is sequence-level action prediction, which helps reduce compounding error and smooth high-frequency manipulation. [^act]

#### Q19. What is an action chunk?

**Core answer:** An action chunk is a short sequence of future actions predicted together.

A one-step policy predicts:

\[
o_t \rightarrow a_t
\]

A chunking policy predicts:

\[
o_t \rightarrow [a_t,a_{t+1},\ldots,a_{t+H-1}]
\]

This lets the model represent a short motion with shared temporal intent. It can reduce inference frequency and improve smoothness.

Deployment often uses **receding horizon control**. The model predicts \(H\) actions, executes only the first \(k\), observes the world again, and replans. This combines short-horizon consistency with closed-loop correction.

#### Q20. What is Diffusion Policy?

**Core answer:** Diffusion Policy generates a continuous action trajectory by iteratively transforming a noisy action sequence into a task-consistent one.

Start with a random action chunk:

\[
A^K \sim \mathcal{N}(0,I)
\]

Then repeatedly refine it:

\[
A^K \rightarrow A^{K-1} \rightarrow \cdots \rightarrow A^0
\]

The observation, robot state, and task context condition every refinement step. The final \(A^0\) is the action chunk.

The main advantage is multimodality. If both a left path and a right path are valid, a simple MSE regressor can average them into an invalid middle path. A diffusion model can represent several modes in \(P(A|o)\). Diffusion Policy explicitly combines action diffusion with visual conditioning and receding-horizon control. [^diffusion-policy]

#### Q21. Why does action diffusion help with multimodal behavior?

**Core answer:** It models a distribution over valid trajectories and can preserve multiple action modes.

Suppose two demonstrated trajectories go around an obstacle on opposite sides:

\[
A_L,\quad A_R
\]

A squared-error regressor can favor:

\[
A_{avg}\approx\frac{A_L+A_R}{2}
\]

The average can collide with the obstacle. A generative policy can assign probability mass to both valid modes and sample one coherent trajectory.

#### Q22. What is a vector field?

**Core answer:** A vector field assigns a direction and magnitude to every point in a space.

Write it as:

\[
v(x,t)
\]

At position \(x\) and time \(t\), \(v\) tells the sample which direction to move and how fast. For an action chunk, \(x\) can be the entire flattened trajectory vector.

A useful intuition is a field of arrows. Each arrow says how a current noisy action should move toward a more realistic action.

#### Q23. What is Flow Matching?

**Core answer:** Flow Matching trains a model to predict a time-dependent vector field that transports samples from a simple distribution, usually noise, toward the data distribution.

The learned dynamics are:

\[
\frac{dx}{dt}=v_\theta(x,t)
\]

Starting from noise \(x(0)\), an ODE solver integrates the vector field until the sample reaches \(x(1)\), which follows the target data distribution.

For robot actions, the model can take a noisy action chunk, the current time, and the observation, then predict the velocity of that action chunk in action space.

Flow Matching regresses vector fields associated with chosen probability paths. Optimal Transport Flow Matching is one possible path construction, while general Flow Matching also supports other probability paths. [^flow-matching]

#### Q24. Diffusion versus Flow Matching?

**Core answer:** Both can transform noise into multimodal continuous actions. Their training targets and sampling formulations differ.

- **Diffusion:** Commonly learns denoising, score, noise, or velocity targets along a noising process.
- **Flow Matching:** Directly regresses a vector field for a chosen probability path and samples by integrating an ODE.

Flow-based policies can work with relatively few solver steps in some designs. Sampling speed depends on architecture, solver, distillation, and training setup, so the speedup is method-specific.

#### Q25. When does plain MSE regression become insufficient for a robot policy?

**Core answer:** MSE works well for unimodal targets, while multimodal tasks can make its conditional mean undesirable.

If several actions are valid for the same observation, MSE encourages an average. The average can be physically invalid, especially for obstacle avoidance, grasp strategy, or contact-rich manipulation.

Diffusion and flow models instead represent richer conditional action distributions.

## 4. English Edition: Classic VLA Architectures

#### Q26. What is the core idea of OpenVLA?

**Core answer:** OpenVLA turns multimodal perception and language understanding into autoregressive action-token prediction.

OpenVLA is a 7B open-source VLA based on a Llama 2 language model and a visual encoder that fuses DINOv2 and SigLIP features. It was trained on a diverse collection of robot demonstrations and predicts discretized action tokens autoregressively. [^openvla]

The architectural idea is:

\[
\text{Visual Tokens + Language Tokens}
\rightarrow
\text{LLM}
\rightarrow
\text{Action Tokens}
\]

#### Q27. What is the main difference between RT-1 and RT-2?

**Core answer:** RT-1 focuses on scaling robot control from large robot datasets. RT-2 adds web-scale vision-language knowledge and co-fine-tunes it with robot trajectories.

RT-1 is a multi-task Robotics Transformer trained on large-scale real robot data, with tokenized inputs and actions for real-time control. [^rt1]

RT-2 starts from large vision-language models, trains jointly on web vision-language tasks and robot trajectories, and expresses robot actions as text-like tokens. This allows semantic knowledge from web-scale pretraining to influence robotic control. [^rt2]

#### Q28. What is the core idea of Octo?

**Core answer:** Octo is a generalist robot policy pretrained across diverse robot datasets and designed for adaptation to new robots and observation or action spaces.

Octo is a transformer-based policy trained on 800k trajectories from Open X-Embodiment. It supports language or goal-image conditioning and can be fine-tuned to new robot setups. [^octo]

Its central goal is:

\[
\text{Many Tasks + Many Embodiments}
\rightarrow
\text{Reusable Policy Initialization}
\]

#### Q29. What is cross-embodiment learning?

**Core answer:** It learns reusable behavior across robots with different bodies, sensors, kinematics, and control interfaces.

Robots may differ in joint count, reachable workspace, camera placement, gripper geometry, action frequency, and controller interface. Cross-embodiment methods seek a shared representation, for example task semantics or end-effector motion, then map it to embodiment-specific commands.

A common design is:

\[
\text{Shared Representation}
\rightarrow
\text{Robot-Specific Adapter}
\rightarrow
\text{Robot Action}
\]

## 5. English Edition: Reinforcement Learning and Post-Training

#### Q30. What is the core idea of PPO?

**Core answer:** PPO performs policy-gradient updates while limiting how aggressively the new policy can move away from the behavior policy that generated the data.

Define the probability ratio:

\[
r_t(\theta)
=
\frac{\pi_\theta(a_t|s_t)}
{\pi_{\theta_{old}}(a_t|s_t)}
\]

The clipped objective is:

\[
L^{CLIP}
=
\mathbb{E}
\left[
\min
\left(
r_tA_t,
\mathrm{clip}(r_t,1-\epsilon,1+\epsilon)A_t
\right)
\right]
\]

The clipping mechanism makes very large policy-ratio changes stop producing additional improvement in the surrogate objective. PPO alternates between environment sampling and multiple epochs of minibatch optimization. [^ppo]

#### Q31. What problem does PPO clipping solve?

**Core answer:** It limits overly aggressive policy updates.

When the new policy changes an action probability too much relative to the old policy, the clipped objective caps the benefit of pushing the ratio farther. This creates a conservative update region around the old policy.

#### Q32. What problem does GAE solve?

**Core answer:** Generalized Advantage Estimation trades bias against variance when estimating policy advantages.

The TD residual is:

\[
\delta_t
=
r_t+\gamma V(s_{t+1})-V(s_t)
\]

GAE combines residuals:

\[
A_t^{GAE}
=
\delta_t
+
\gamma\lambda\delta_{t+1}
+
(\gamma\lambda)^2\delta_{t+2}
+\cdots
\]

Smaller \(\lambda\) places more weight on short-horizon bootstrapping. Larger \(\lambda\) incorporates longer returns. GAE was introduced as an exponentially weighted advantage estimator for high-dimensional continuous control. [^gae]

#### Q33. How do PPO, SAC, and TD3 differ?

**Core answer:** PPO is on-policy. SAC and TD3 are off-policy actor-critic methods.

- **PPO:** Stable and widely used. Training continually requires fresh policy data.
- **SAC:** Off-policy and stochastic. It optimizes reward together with policy entropy, which promotes exploration. [^sac]
- **TD3:** Off-policy and deterministic. It uses twin critics, delayed actor updates, and target policy smoothing to reduce function-approximation error and overestimation. [^td3]

When real interaction is expensive, off-policy reuse can improve sample efficiency. When simulation is cheap and stable policy-gradient training matters, PPO is a common option.

#### Q34. What is a replay buffer?

**Core answer:** A replay buffer stores past transitions so an off-policy algorithm can reuse them for training.

A transition is commonly:

\[
(s_t,a_t,r_t,s_{t+1})
\]

The buffer contains many transitions:

\[
D=\{(s,a,r,s'),\ldots\}
\]

Training samples minibatches from \(D\). This allows one environment interaction to contribute to multiple parameter updates.

#### Q35. Is replay buffer training different from interacting with the environment?

**Core answer:** In online off-policy RL, both happen in the same loop.

The agent interacts with the environment, stores new transitions, and trains from the accumulated replay buffer:

\[
\text{Environment}
\rightarrow
\text{Replay Buffer}
\rightarrow
\text{Training}
\]

SAC and TD3 use this pattern. The buffer is a reuse mechanism for interaction data.

PPO follows an on-policy pattern. It collects trajectories with the current policy, performs a limited number of updates, then collects fresh trajectories because old data becomes increasingly mismatched with the current policy.

#### Q36. What is the difference between a replay buffer and offline RL?

**Core answer:** A replay buffer in online off-policy RL keeps receiving new interaction data. Offline RL uses a dataset fixed before learning begins.

In online off-policy RL:

\[
D_1 \rightarrow D_2 \rightarrow D_3
\]

The dataset grows or changes as the policy acts.

In offline RL, the dataset is fixed before learning begins. The major challenge is distribution shift, because the learned policy may choose actions poorly represented in the dataset. Common offline RL methods include IQL, CQL, and BCQ.

## 6. English Edition: Data, Action Grounding, Representation Learning, and Sim2Real

#### Q37. What can you do when robot data is limited?

**Core answer:** Combine augmentation, simulation, cross-robot data, and large-scale pretraining.

Useful sources include image augmentation, camera or state perturbations, synthetic trajectories, domain randomization, Open X-Embodiment style cross-robot data, internet images, videos, human demonstrations, and egocentric video.

The broad strategy is to learn reusable world knowledge from abundant non-robot data, then connect it to robot actions with a smaller amount of robot data.

#### Q38. What does "grounding pretrained knowledge to robot action" mean?

**Core answer:** It connects semantic or visual representations learned from large-scale data to the concrete motor commands of a robot.

A pretrained VLM may know what a cup, drawer, or handle looks like. Robot grounding teaches the mapping:

\[
\text{Visual-Language Representation}
\rightarrow
\text{Executable Robot Action}
\]

The model moves from knowing what the scene means to knowing how this embodiment should act.

#### Q39. What are common ways to ground with a small amount of robot data?

**Core answer:** There are several levels of adaptation.

1. **Freeze the backbone and train an action head.**  
   Use pretrained features and learn only the mapping to actions.

2. **LoRA or adapters.**  
   Update a small subset of parameters together with the action head.

3. **Action-token supervised fine-tuning.**  
   Convert actions to discrete tokens and train the VLM to predict them.

4. **Continuous action head.**  
   Feed backbone features to an MLP, diffusion model, or flow model that predicts continuous actions.

5. **World or video pretraining followed by robot grounding.**  
   Learn object motion, interaction, and temporal structure from large video corpora, then use robot trajectories to associate those representations with executable control.

OpenVLA demonstrates low-rank fine-tuning for VLA adaptation, while Octo is explicitly designed as a reusable policy initialization for new robot setups. [^openvla] [^octo]

#### Q40. What is representation learning?

**Core answer:** Representation learning is the process of learning useful internal features from raw data.

An image begins as pixels:

\[
\text{Image}
\rightarrow
\text{Encoder}
\rightarrow
z
\]

The latent representation \(z\) can encode information such as object identity, location, orientation, geometry, motion, contact cues, or task semantics.

For robotics, useful representations can be grouped into:

- **Semantic representation:** What object or task is present.
- **Geometric representation:** Where objects are and how they are oriented.
- **Motion representation:** How states evolve over time.
- **Action representation:** How a skill or trajectory is organized for control.

A strong representation compresses raw observations while retaining information needed by the policy.

#### Q41. Why is representation learning important for VLA systems?

**Core answer:** It reduces the burden on the action policy by converting raw sensory data into task-relevant structure.

The full pipeline can be written as:

\[
\text{Observation}
\rightarrow
\text{Representation}
\rightarrow
\text{Policy}
\rightarrow
\text{Action}
\]

Semantic encoders help recognize objects and instructions. Geometric encoders help localize and align. Video or world-model representations can add motion and future-state information. The policy then learns control from a more informative latent state.

#### Q42. If you only have 100 demonstrations, how should you use them?

**Core answer:** Start from imitation learning and pretrained representations, then spend additional data collection on the most informative states.

A practical order is:

1. Train a behavior-cloning policy from the demonstrations.
2. Freeze most of the pretrained vision-language backbone.
3. Fine-tune only the action head, LoRA modules, or adapters.
4. Apply augmentations that preserve action semantics.
5. Collect targeted additional data from failures, uncertain states, and rare conditions.
6. Add online RL only when safe interaction is available.

#### Q43. Should failed trajectories be kept?

**Core answer:** Yes, if their role in the learning objective is explicit.

Behavior cloning treats demonstrated actions as targets, so directly mixing failed actions as positive examples can teach the wrong behavior. Failed trajectories are valuable for failure classification, value learning, preference learning, reward learning, recovery policies, and negative examples.

#### Q44. What is the core Sim2Real problem?

**Core answer:** The simulator and the real robot follow different observation and transition distributions.

A compact expression is:

\[
P_{sim}(o,a,s')
\neq
P_{real}(o,a,s')
\]

The gap can come from:

- **Visual differences:** Texture, lighting, background, camera.
- **Dynamics differences:** Friction, mass, actuator response, latency.
- **Sensor differences:** Noise and calibration.

#### Q45. What are the main Sim2Real techniques?

**Core answer:** Broaden the simulation distribution, learn robust representations, and adapt with real data.

- **Domain randomization:** Randomize texture, lighting, camera, friction, mass, and related factors.
- **Representation learning:** Learn features that retain geometry, motion, and object structure across appearance changes.
- **Real-data fine-tuning:** Adapt simulation-trained parameters using a small amount of real robot data.
- **Online adaptation:** Update a dynamics model, latent state, or policy adapter during deployment.

## 7. English Edition: Control and Deployment

#### Q46. How do you bridge a 3 Hz VLA and a 50 Hz robot controller?

**Core answer:** Use hierarchical control.

The VLA runs at a lower frequency and outputs a target pose, waypoint, trajectory, or action chunk. A fast low-level controller tracks that target:

\[
\text{VLA}
\rightarrow
\text{Target or Trajectory}
\rightarrow
\text{OSC, MPC, or Impedance Controller}
\rightarrow
\text{Motor Command}
\]

The VLA handles semantic decisions and short-horizon planning. The low-level controller handles high-frequency feedback and physical stability.

#### Q47. Why does a robot arm jitter, and how can you reduce it?

**Core answer:** Jitter can come from policy inconsistency, perception noise, aggressive control gains, or variable system latency.

Useful remedies include action chunking, temporal ensembling, smoothness regularization, low-pass filtering, impedance control, MPC, and velocity or acceleration constraints.

A simple smoothness term is:

\[
L=
L_{action}
+
\lambda_v\|a_t-a_{t-1}\|^2
\]

#### Q48. How do ONNX, TensorRT, and Triton differ?

**Core answer:** They operate at different layers of deployment.

- **ONNX:** A model exchange format. ONNX Runtime is an inference runtime.
- **TensorRT:** NVIDIA's optimized inference engine for GPU execution, including graph optimization and lower precision execution.
- **Triton Inference Server:** A serving layer for requests, batching, concurrency, scheduling, and multiple model backends.

A common cloud serving stack is:

\[
\text{Model}
\rightarrow
\text{TensorRT}
\rightarrow
\text{Triton Serving}
\]

#### Q49. What can you do if INT8 quantization hurts accuracy?

**Core answer:** Improve calibration, keep sensitive operations at higher precision, or train with quantization effects.

Common approaches are:

- Use representative calibration data from the real task distribution.
- Keep sensitive layers in FP16 or BF16 and quantize the rest.
- Use quantization-aware training so the model sees quantization noise during training.

#### Q50. When is KV cache useful for a VLA?

**Core answer:** KV cache is most useful when the VLA performs substantial autoregressive token decoding.

For an autoregressive Transformer, cached keys and values avoid recomputing all previous tokens during each new decoding step.

If a policy generates an action chunk in one forward pass, or uses diffusion or flow sampling, traditional LLM-style KV cache provides less direct benefit.

#### Q51. How do batching and latency trade off?

**Core answer:** Larger batches improve throughput and hardware utilization, while batch formation can increase response latency.

Edge robot deployment commonly uses batch size one because control latency matters most. Cloud robot services can use dynamic batching when many robots send concurrent requests.

#### Q52. CPU, GPU, or NPU?

**Core answer:** Choose based on operator support, latency, throughput, power, and deployment constraints.

- **CPU:** Broad compatibility and simple deployment, with higher latency for large models.
- **GPU:** Strong Transformer support, mature kernels, and high throughput.
- **NPU:** Strong power efficiency for supported graphs, with more constraints from compiler and operator coverage.

## 8. English Edition: Scenario Questions

#### Q53. How do you transfer a VLA to a new robot with different DoF, sensors, and control frequency?

**Core answer:** Align observations, use a shared action interface where possible, then add embodiment-specific adaptation.

A practical stack is:

1. **Observation adapter:** Normalize image format, camera representation, and proprioception.
2. **Shared action representation:** Predict end-effector motion or another embodiment-independent interface when appropriate.
3. **Kinematic mapping:** Convert end-effector commands to joints with IK or a low-level controller.
4. **Embodiment adapter:** Add robot-specific action heads or adapters.
5. **Few-shot fine-tuning:** Adapt LoRA, adapters, or the action head using a small target-robot dataset.

#### Q54. How do you adapt to a new task with only a few demonstrations?

**Core answer:** Reuse pretrained perception and manipulation priors, then adapt the smallest necessary part of the policy.

Useful choices include LoRA, action-head fine-tuning, adapter tuning, skill composition, and demonstration conditioning when the architecture supports in-context robot learning.

A long task can also be decomposed:

\[
\text{Locate}
\rightarrow
\text{Open}
\rightarrow
\text{Grasp}
\rightarrow
\text{Place}
\]

A high-level planner selects or sequences skills, while the low-level VLA or policy executes them.

#### Q55. Why does a VLA still need a conventional controller?

**Core answer:** The VLA and controller solve different time-scale problems.

A VLA is strong at perception, language grounding, semantic reasoning, and action generation. A conventional controller is strong at high-frequency feedback, stability, and dynamics compensation.

The resulting hierarchy is:

\[
\text{VLA}
\rightarrow
\text{Trajectory or Target}
\rightarrow
\text{Controller}
\rightarrow
\text{Robot}
\]

#### Q56. What is the hardest part of cross-embodiment transfer?

**Core answer:** The shared skill must remain meaningful across different physical bodies and interfaces.

Differences include kinematics, workspace, camera viewpoint, gripper geometry, action frequency, joint limits, and controller semantics. A robust system therefore separates shared task structure from embodiment-specific execution.

## 9. English Edition: Five-Layer Interview Framework

When a new VLA interview question appears, place it into one of five layers:

1. **Perception:** What does the robot observe?  
   Keywords: CLIP, SigLIP, DINO, depth, 3D, multi-view.

2. **Representation and reasoning:** What internal information does the model extract and combine?  
   Keywords: VLM, grounding, attention, world model, geometry, semantics.

3. **Action generation:** How is the action represented and generated?  
   Keywords: action tokens, continuous actions, autoregressive decoding, diffusion, flow matching, action chunking.

4. **Control:** How is the generated target executed stably?  
   Keywords: IK, OSC, MPC, impedance control, receding horizon.

5. **Learning and deployment:** How does the system acquire and serve the policy?  
   Keywords: BC, RL, offline RL, Sim2Real, cross-embodiment, quantization, TensorRT.

The complete mental model is:

\[
\boxed{
\text{Perception}
\rightarrow
\text{Representation}
\rightarrow
\text{Reasoning}
\rightarrow
\text{Action}
\rightarrow
\text{Control}
}
\]

Training, adaptation, and deployment determine how each layer becomes usable on a real robot.

*本部分与英文版问题编号完全对应，保留同一套面试知识结构。答案先给核心结论，再补最必要的机制与区分，适合面试前快速复习。*

## 10. 中文版：VLA 基础概念

#### Q1. VLA 和普通 LLM 的核心区别是什么？

**核心回答：** LLM 主要预测语言 token，VLA 则把视觉、语言以及机器人状态映射为可执行动作。

VLA 常见输入包括 RGB 或 Depth 图像、语言指令、关节角和末端位姿等 proprioception，以及历史 observation 或 action。输出可以是离散 action token、连续 action、action chunk、末端目标位姿或 joint command。

最重要的整体关系是：

\[
\text{Vision + Language + Robot State} \rightarrow \text{Action}
\]

视觉语言 backbone 提供语义理解，机器人数据负责把这些知识连接到真实控制。

#### Q2. Observation Tokenizer 是什么？

**核心回答：** 它把原始 observation 转成 Transformer 或 policy 可以处理的表示。

图像通常先经过 ViT、SigLIP、DINO 等视觉编码器，得到连续 visual tokens。机器人状态可以经过 MLP 变成 state tokens，再和语言 token 一起送入模型。

现代 VLA 中，视觉 observation 很多时候保持为连续 embedding。离散的 k-means tokenizer 只是可选方案之一。

#### Q3. Action Tokenizer 是什么？

**核心回答：** 它把机器人动作转换成模型更容易预测的表示。

常见方案有三类：

- **Action binning：** 把每一维连续动作切成多个区间，预测对应 class 或 token。
- **Learned tokenizer：** 学习 codebook，例如 VQ 风格的动作表示。
- **Continuous action：** 直接预测实数动作，可以接 MLP、Diffusion 或 Flow Matching。

不同方案会影响输出空间、训练目标、动作精度和推理方式。

#### Q4. Action Binning 里的 bin 到底是什么？

**核心回答：** bin 就是连续数值范围中的一个小区间。

假设：

\[
a\in[-1,1]
\]

如果分成 4 个 bin，可以得到：

\[
[-1,-0.5),\ [-0.5,0),\ [0,0.5),\ [0.5,1]
\]

真实动作 \(0.37\) 落在第三个区间，模型预测的是这个区间对应的 bin ID，之后再把 ID 转回一个代表性的连续值。

如果均匀分成 \(N\) 个 bin：

\[
\text{bin width}
=
\frac{a_{\max}-a_{\min}}{N}
\]

bin 越多，动作分辨率越高，量化误差越小，同时分类空间也会更大。多维 action 通常可以逐维做 binning。

#### Q5. 离散 action 和连续 action 是两种不同的物理动作吗？

**核心回答：** 它们通常是同一个物理动作的两种表示方式。

例如机械臂需要移动 \(1.2\) cm。离散方案把这个数值编码成一个 token，再反量化回连续控制值。连续方案直接预测 \(1.2\) cm 对应的实数。

离散 action 的优势是可以直接复用 LLM 的 classification 和 autoregressive decoding。连续 action 保留更高精度，也更适合 regression、Diffusion 和 Flow Matching。

分层系统还可以同时使用两者。高层预测 `GRASP` 这样的离散 skill，低层输出连续末端轨迹或关节命令。

## 11. 中文版：视觉与多模态表征

#### Q6. CLIP、DINO、SigLIP 怎么选？

**核心回答：** 三者强调的视觉信息不同。

- **CLIP：** 图文语义对齐强，开放词汇识别能力好，训练目标对局部几何并不特别强调。
- **DINO 或 DINOv2：** 自监督视觉结构、局部 correspondence 和 object-centric feature 较强，本身没有天然语言对齐。
- **SigLIP：** 也是强图文对齐模型，使用 sigmoid 风格目标，扩展性好。

机器人 manipulation 同时需要语义和几何，因此现代系统经常融合多种视觉特征。OpenVLA 就把 DINOv2 和 SigLIP 的视觉特征与 Llama 2 语言模型结合起来。 [^openvla]

#### Q7. MLP Projection 和 Perceiver Resampler 有什么区别？

**核心回答：** MLP Projection 主要做 feature space 对齐，Perceiver Resampler 还可以压缩 token 数量。

MLP 的典型形式是：

\[
z_i^{vision}
\rightarrow
\mathrm{MLP}
\rightarrow
z_i^{LLM}
\]

视觉 token 数量通常基本不变。

Perceiver 风格的 resampler 使用 learnable queries 做 cross-attention：

\[
Q
\xrightarrow{\text{cross-attention}}
\text{Visual Tokens}
\]

它可以把几百个视觉 token 压缩成几十个 latent token，从而缩短上下文。

#### Q8. 高分辨率图像导致 token 爆炸怎么办？

**核心回答：** 压缩冗余视觉 token，同时保留任务相关细节。

对于 patch size 为 \(P\) 的 ViT：

\[
N=\frac{H}{P}\frac{W}{P}
\]

图像长宽都翻倍后，token 数大约变成四倍。

常见做法包括增大 patch size、token pooling、token merging、Perceiver Resampler、ROI 选择和多尺度特征。一个很实用的思路是全局低分辨率负责语义，机械臂和目标物体附近保留局部高分辨率。

#### Q9. ViT 下采样后，低层几何信息怎么保留？

**核心回答：** 融合不同深度的视觉特征，并加入几何相关监督。

浅层 feature 更容易保留 edge、texture 和 local geometry，深层 feature 更强调整体语义和上下文。可以做：

\[
F=\mathrm{Fuse}(F_{early},F_{middle},F_{late})
\]

也可以加入 depth prediction、optical flow、segmentation、3D reconstruction 或 correspondence 等辅助任务，让表示主动保留机器人控制需要的几何信息。

#### Q10. Cross-Attention 应该放前端、中间还是全层？

**核心回答：** 这是视觉信息保留程度和计算开销之间的权衡。

- **Early Fusion：** 视觉信息较早进入模型，计算便宜。
- **Interleaved Cross-Attention：** 每隔若干层重新注入视觉信息。
- **Dense Fusion：** 多层持续做跨模态交互，信息交互更充分，计算也更大。

实际设计要根据 latency、模型规模和任务对精细 grounding 的需求来选。

#### Q11. 多视角相机特征怎么融合？

**核心回答：** 每个视角先独立编码，再显式告诉模型每个 token 对应哪台相机以及相机几何。

简单做法是：

\[
Camera_i
\rightarrow
Encoder
\rightarrow
Tokens_i
\]

然后把多个视角的 token 拼接，并加入 camera ID、camera pose、intrinsics 和 extrinsics。

更强调几何的方案可以先把多个视角投影到统一 3D 空间，再做融合。

#### Q12. 长语言指令和局部视觉特征怎么对齐？

**核心回答：** 语言 self-attention 建模指令内部关系，跨模态 attention 或 grounding 模块把实体词和视觉区域连接起来。

例如：

\[
\text{red cup}
\leftrightarrow
\text{image region}
\]

\[
\text{drawer}
\leftrightarrow
\text{image region}
\]

object query、region feature、segmentation supervision 和 object-centric representation 都可以增强这种局部 grounding。

#### Q13. 指令里有 "this"、"that" 之类歧义怎么办？

**核心回答：** 利用视觉上下文、历史信息和 referential grounding 共同判断指代对象。

常见机制包括视觉语言 joint attention、object detection、segmentation、tracking 和 temporal context。如果多个对象仍然同样合理，真实系统可以要求用户进一步澄清。

## 12. 中文版：动作表示与动作生成

#### Q14. Action Tokenization 里，离散分箱和连续回归怎么选？

**核心回答：** 主要看精度、多模态程度、延迟，以及是否需要复用语言模型输出头。

离散动作：

\[
a
\rightarrow
\mathrm{bin}(a)
\rightarrow
\mathrm{token}
\]

它可以直接做 classification 和 cross-entropy，但存在量化误差。

连续动作：

\[
z
\rightarrow
\mathrm{Action\ Head}
\rightarrow
a
\]

它保留真实数值精度。任务存在明显多模态动作时，简单 MSE 容易平均不同模式，因此常用 Diffusion 或 Flow Matching 来生成连续动作。

#### Q15. 欧拉角为什么对神经网络不友好？

**核心回答：** 欧拉角有奇异点、数值不连续和旋转顺序依赖三个主要问题。

第一，**gimbal lock** 会在特定姿态下让两个旋转轴重合，参数化局部失去一个独立旋转自由度。

第二，角度存在周期边界。例如 \(179^\circ\) 和 \(-179^\circ\) 的真实姿态只差 \(2^\circ\)，直接用数值做 MSE 却会看到 \(358^\circ\) 的差距。物理上平滑的动作因此可能在监督信号里突然跳变。

第三，Euler angle 依赖旋转顺序。XYZ 和 ZYX 的定义不同，因此数据和模型必须始终使用一致 convention。

#### Q16. 欧拉角、四元数、6D Rotation 怎么选？

**核心回答：** 6D Rotation 对神经网络学习通常更连续。

- **Euler Angle：** 3 个参数，紧凑，但有 gimbal lock 和不连续。
- **Quaternion：** 4 个参数，没有 gimbal lock，但 \(q\) 和 \(-q\) 表示同一个旋转，还需要单位模约束。
- **6D Rotation：** 预测两个 3D 向量，再正交化恢复 rotation matrix。

常见构造是：

\[
b_1=\frac{a_1}{\|a_1\|}
\]

\[
b_2=
\frac{a_2-(b_1^\top a_2)b_1}
{\|a_2-(b_1^\top a_2)b_1\|}
\]

\[
b_3=b_1\times b_2
\]

最终：

\[
R=[b_1,b_2,b_3]
\]

Zhou 等人的工作指出，3D rotation 可以在 5D 和 6D 欧氏空间中构造连续表示，这类表示更适合神经网络学习。 [^rotation6d]

#### Q17. Autoregressive Policy 是什么？

**核心回答：** 它把动作序列拆成一连串条件预测。

\[
P(a_1,\ldots,a_T|o)
=
\prod_tP(a_t|a_{<t},o)
\]

它可以直接复用 Transformer decoding。代价是后面的输出依赖前面的预测，早期误差可能继续传播，而且 token-by-token decoding 会增加延迟。

OpenVLA 的离散 action token 预测属于这种思路。 [^openvla]

#### Q18. ACT 是 Autoregressive Policy 吗？

**核心回答：** ACT 最应该记住的是 Action Chunking。

Action Chunking with Transformers 一次预测一段未来动作，并使用 conditional VAE 建模 demonstration 中的行为变化。它通过 sequence-level action prediction 来降低误差累积，并改善高频 manipulation 的平滑性。 [^act]

#### Q19. Action Chunk 到底是什么？

**核心回答：** Action Chunk 就是一次预测的一小段未来动作序列。

单步 policy：

\[
o_t\rightarrow a_t
\]

Action Chunking：

\[
o_t
\rightarrow
[a_t,a_{t+1},\ldots,a_{t+H-1}]
\]

模型因此可以把一段动作当作一个具有共同意图的短轨迹来建模，减少每一步都重新推理带来的抖动和开销。

实际系统经常使用 **receding horizon**。例如预测未来 16 步，只执行前 4 步，然后重新观察，再预测新的 16 步。这样可以同时保持短期轨迹的一致性和 closed-loop correction。

#### Q20. Diffusion Policy 到底在做什么？

**核心回答：** 它从一条随机的连续动作序列开始，经过多次条件去噪，把这条随机轨迹逐渐修成合理的 action chunk。

首先采样：

\[
A^K\sim\mathcal{N}(0,I)
\]

然后多次更新：

\[
A^K
\rightarrow
A^{K-1}
\rightarrow
\cdots
\rightarrow
A^0
\]

每一步都会参考当前图像、机器人状态和任务条件。最终的 \(A^0\) 就是机器人准备执行的动作块。

Diffusion Policy 的核心优势是可以表示 multimodal action distribution。绕障碍物时，从左边绕和从右边绕都可能正确。生成模型可以保留两个 mode，而简单 MSE 可能把它们平均到中间。原始 Diffusion Policy 也明确结合了视觉条件和 receding-horizon control。 [^diffusion-policy]

#### Q21. 为什么 Diffusion 很适合多模态动作？

**核心回答：** 它学习一组合理轨迹的分布，可以保留多个 action mode。

假设：

\[
A_L
\]

表示从左边绕，

\[
A_R
\]

表示从右边绕。

MSE 很容易偏向：

\[
A_{avg}
\approx
\frac{A_L+A_R}{2}
\]

这个平均轨迹可能正好撞上障碍物。Diffusion 可以给两个有效 mode 都保留概率质量，再采出其中一条完整轨迹。

#### Q22. Vector Field 是什么？

**核心回答：** Vector field 就是在空间中的每一个位置都放一个带方向和大小的箭头。

写成：

\[
v(x,t)
\]

含义是：一个样本当前位于 \(x\)，时间是 \(t\)，它下一瞬间应该往哪个方向移动，以及移动多快。

放到机器人里，\(x\) 可以是整条 action chunk 展平后的高维向量。vector field 告诉当前这个 noisy action chunk 应该朝什么方向修改。

#### Q23. Flow Matching 是什么？

**核心回答：** Flow Matching 学一个随时间变化的 vector field，把简单分布中的样本逐渐输运到真实数据分布。

模型学习：

\[
\frac{dx}{dt}=v_\theta(x,t)
\]

从 noise \(x(0)\) 出发，通过 ODE solver 沿 vector field 积分，最终得到 \(x(1)\)。

在机器人场景里，模型可以输入 noisy action chunk、时间 \(t\)、图像和语言条件，然后预测这条 action chunk 在动作空间中应该朝哪个方向变化。

Flow Matching 训练的是指定 probability path 对应的 vector field。Optimal Transport Flow Matching 是其中一种 path 设计，Flow Matching 本身并不自动等于最优传输。 [^flow-matching]

#### Q24. Diffusion 和 Flow Matching 怎么比较？

**核心回答：** 两者都可以从 noise 生成 multimodal continuous action，主要区别在训练目标和采样形式。

- **Diffusion：** 常见目标包括 denoising、score、noise 或 velocity prediction。
- **Flow Matching：** 直接拟合 probability path 对应的 vector field，推理时通过 ODE integration 得到样本。

一些 flow-based policy 可以用较少 solver steps，但速度取决于 architecture、solver、distillation 和训练方式，不能简单记成固定的几倍加速。

#### Q25. 为什么机器人 policy 不直接全用 MSE Regression？

**核心回答：** MSE 对单峰目标很自然，多峰动作分布中可能会把多个正确方案平均成一个错误方案。

障碍物绕行、抓取方式和接触操作经常有多个合理 trajectory。Diffusion 和 Flow Matching 可以显式表示更丰富的 \(P(A|o)\)，因此更适合这类任务。

## 13. 中文版：经典 VLA 架构

#### Q26. OpenVLA 的核心架构是什么？

**核心回答：** OpenVLA 把视觉和语言信息送入大语言模型，再自回归预测离散 action token。

OpenVLA 是 7B 开源 VLA，使用 Llama 2，并融合 DINOv2 和 SigLIP 视觉特征，在大规模机器人 demonstration 上训练。 [^openvla]

可以记成：

\[
\text{Visual Tokens + Language Tokens}
\rightarrow
\text{LLM}
\rightarrow
\text{Action Tokens}
\]

#### Q27. RT-1 和 RT-2 最大区别是什么？

**核心回答：** RT-1 重点是用大规模机器人数据训练通用 robot policy，RT-2 进一步把 web-scale vision-language knowledge 引入机器人控制。

RT-1 是多任务 Robotics Transformer，使用大规模真实机器人数据和 tokenized action 做实时控制。 [^rt1]

RT-2 从大型 VLM 出发，把 web vision-language tasks 和 robot trajectories 一起 co-fine-tune，并把机器人 action 表示成类似文本的 token。这样 web 预训练得到的语义知识就可以进入机器人 action prediction。 [^rt2]

#### Q28. Octo 的核心思想是什么？

**核心回答：** Octo 是跨任务、跨机器人预训练的 generalist robot policy，重点是给新机器人和新 observation 或 action space 提供可复用的初始化。

Octo 使用 Open X-Embodiment 中 80 万条 trajectory 训练 Transformer policy，并支持 language 或 goal image 条件。 [^octo]

核心目标是：

\[
\text{Many Tasks + Many Embodiments}
\rightarrow
\text{Reusable Policy Initialization}
\]

#### Q29. Cross-Embodiment 是什么？

**核心回答：** Cross-embodiment 的目标是让不同机器人共享可迁移的 skill 或 representation，再映射到各自的执行接口。

不同机器人会在 joint number、kinematics、camera setup、workspace、gripper geometry、action frequency 和 controller interface 上存在差异。

常见结构是：

\[
\text{Shared Representation}
\rightarrow
\text{Robot-Specific Adapter}
\rightarrow
\text{Robot Action}
\]

## 14. 中文版：强化学习与后训练

#### Q30. PPO 的核心思想是什么？

**核心回答：** PPO 用 policy gradient 更新策略，同时限制新策略相对采样旧策略发生过大的概率变化。

定义概率比：

\[
r_t(\theta)
=
\frac{\pi_\theta(a_t|s_t)}
{\pi_{\theta_{old}}(a_t|s_t)}
\]

Clipped objective：

\[
L^{CLIP}
=
\mathbb E
\left[
\min
\left(
r_tA_t,
\mathrm{clip}(r_t,1-\epsilon,1+\epsilon)A_t
\right)
\right]
\]

当概率比已经偏离太远时，继续把它推得更远不会继续增加 surrogate objective 的收益。PPO 的训练流程是和环境采一批数据，再对这批数据做若干轮 minibatch 更新。 [^ppo]

#### Q31. PPO 里的 Clip 解决什么问题？

**核心回答：** Clip 主要限制一次 policy update 走得太远。

new policy 对某个动作的概率相对 old policy 改变过大时，clipped objective 会限制继续推动这个方向的收益，从而让更新更加保守。

#### Q32. GAE 解决什么？

**核心回答：** GAE 用一个可调参数在 advantage estimate 的 bias 和 variance 之间做权衡。

TD residual：

\[
\delta_t
=
r_t+\gamma V(s_{t+1})-V(s_t)
\]

GAE：

\[
A_t^{GAE}
=
\delta_t
+
\gamma\lambda\delta_{t+1}
+
(\gamma\lambda)^2\delta_{t+2}
+\cdots
\]

较小 \(\lambda\) 更接近短期 bootstrapping，方差较低。较大 \(\lambda\) 纳入更长的 return。GAE 最初就是作为指数加权 advantage estimator 提出的。 [^gae]

#### Q33. PPO、SAC、TD3 怎么选？

**核心回答：** PPO 是 on-policy，SAC 和 TD3 是 off-policy actor-critic。

- **PPO：** 训练稳定、实现成熟，但需要不断采 fresh policy data。
- **SAC：** stochastic off-policy，目标里加入 entropy，适合 continuous control 和探索。 [^sac]
- **TD3：** deterministic off-policy，通过 twin critics、delayed actor update 和 target policy smoothing 抑制 function approximation error 和过估计。 [^td3]

真实机器人 interaction 很贵时，off-policy 的数据复用能力很有价值。仿真数据便宜且需要稳定 policy-gradient 更新时，PPO 很常见。

#### Q34. Replay Buffer 是什么？

**核心回答：** Replay Buffer 是存历史 transition 的经验仓库，让 off-policy 算法可以反复利用过去的数据训练。

一条 transition 常写成：

\[
(s_t,a_t,r_t,s_{t+1})
\]

整个 buffer：

\[
D=
\{(s,a,r,s'),\ldots\}
\]

训练时从 \(D\) 里随机采 minibatch。同一次真实 interaction 因此可以被用于多次梯度更新。

#### Q35. Replay Buffer 和直接跟环境交互有什么区别？

**核心回答：** 在 online off-policy RL 中，它们是同一个训练循环中的两个阶段。

SAC 或 TD3 会：

\[
\text{Environment}
\rightarrow
\text{Replay Buffer}
\rightarrow
\text{Training}
\]

先和环境交互得到新 transition，再把它存进 buffer，训练时从历史 buffer 里抽数据。

PPO 是 on-policy。它使用当前 policy 采一批 trajectory，训练若干轮后继续用更新后的 policy 重新采数据，因为很旧的数据和当前 policy 越来越不匹配。

#### Q36. Replay Buffer 和 Offline RL 有什么区别？

**核心回答：** online off-policy RL 的 buffer 会持续得到新环境数据，Offline RL 的 dataset 在训练开始前已经固定。

online off-policy：

\[
D_1
\rightarrow
D_2
\rightarrow
D_3
\]

policy 一边学习一边继续交互。

Offline RL 只能在固定数据集里训练，不能继续采新数据。它的核心困难之一是 distribution shift，因为 learned policy 可能选择 dataset 中很少出现的 action。常见方法包括 IQL、CQL 和 BCQ。

## 15. 中文版：数据、Action Grounding、Representation Learning 与 Sim2Real

#### Q37. 机器人数据不够怎么办？

**核心回答：** 同时利用 data augmentation、simulation、cross-robot data 和大规模 pretraining。

可以使用 image augmentation、camera perturbation、sensor noise、synthetic robot trajectories、domain randomization、Open X-Embodiment 类型数据，以及 internet image、video、human demonstration 和 egocentric video。

总体思路是先从大规模非机器人数据中学习 world knowledge，再用更少的 robot data 把这些知识连接到 action。

#### Q38. “用少量 robot data grounding 到 action”是什么意思？

**核心回答：** 让模型把已经学会的视觉语义知识连接到具体机器人的可执行动作。

一个 VLM 可能已经知道杯子、抽屉和把手是什么，也知道它们之间的语义关系。Robot action grounding 进一步学习：

\[
\text{Visual-Language Representation}
\rightarrow
\text{Executable Robot Action}
\]

模型由“知道环境里发生了什么”进一步变成“知道这个机器人具体该怎么动”。

#### Q39. 少量 robot data grounding 到 action 有哪些主要做法？

**核心回答：** 可以从只训练输出层，到局部适配 backbone，再到联合学习 world representation 和 action。

1. **冻结 backbone，只训练 Action Head。**  
   直接从 pretrained feature 学机器人动作映射。

2. **LoRA 或 Adapter。**  
   让少量 backbone 参数适应机器人领域，同时训练 action head。

3. **Action Token SFT。**  
   把连续动作离散成 token，用类似语言模型 supervised fine-tuning 的方式预测 action token。

4. **Continuous Action Head。**  
   backbone 输出 feature，再接 MLP、Diffusion 或 Flow Matching 生成连续动作。

5. **World 或 Video Pretraining + Robot Grounding。**  
   先从大规模视频学习物体运动、交互和时序结构，再用 robot trajectory 建立这些表示和真实控制信号之间的对应关系。

OpenVLA 展示了低秩微调用于 VLA 适配，Octo 则强调作为新机器人 setup 的通用 policy initialization。 [^openvla] [^octo]

#### Q40. Representation Learning 是什么？

**核心回答：** Representation Learning 就是让神经网络自己学习“应该用什么内部特征表示原始数据”。

原始图像是一大堆 pixel：

\[
\text{Image}
\rightarrow
\text{Encoder}
\rightarrow
z
\]

\(z\) 就是 representation。它可以编码物体类别、位置、朝向、几何、运动、接触信息和任务语义。

机器人里常见几类 representation：

- **Semantic representation：** 这是什么物体或任务。
- **Geometric representation：** 它在哪里、朝向如何、和其他物体的空间关系是什么。
- **Motion representation：** 状态如何随时间变化。
- **Action representation：** 一个 skill 或 trajectory 在控制空间里如何组织。

好的 representation 会压缩原始输入，同时保留 policy 真正需要的信息。

#### Q41. Representation Learning 为什么对 VLA 重要？

**核心回答：** 它先把原始传感器输入整理成对控制有意义的信息，让 action policy 不必从 pixel 重新学习所有结构。

整个 pipeline 可以写成：

\[
\text{Observation}
\rightarrow
\text{Representation}
\rightarrow
\text{Policy}
\rightarrow
\text{Action}
\]

semantic feature 帮助识别物体和理解指令，geometric feature 帮助定位和对齐，video 或 world representation 可以加入 motion 和 future dynamics。最终 policy 在更有信息量的 latent state 上学习动作。

#### Q42. 只有 100 条 demonstration 怎么最大化利用？

**核心回答：** 先做 imitation learning 和参数高效适配，再把新增数据采集集中到最有信息量的状态。

推荐顺序：

1. 用 demonstration 做 Behavior Cloning。
2. 冻结大部分 pretrained vision-language backbone。
3. 只训练 action head、LoRA 或 adapter。
4. 使用不破坏动作语义的数据增强。
5. 继续采 failure、uncertain state 和 rare state。
6. 有安全在线交互条件时再加入 RL fine-tuning。

#### Q43. 失败轨迹要不要保留？

**核心回答：** 要保留，但需要明确它在 loss 里扮演什么角色。

Behavior Cloning 会把 demonstration action 当成正确标签，因此失败动作不能直接全部当正样本。失败轨迹更适合训练 failure classifier、value model、preference model、reward model、recovery policy，或者作为 negative example。

#### Q44. Sim2Real 的核心问题是什么？

**核心回答：** simulator 和真实世界的 observation 与 transition distribution 不一致。

可以写成：

\[
P_{sim}(o,a,s')
\neq
P_{real}(o,a,s')
\]

主要差异包括：

- **Visual Gap：** texture、lighting、background、camera。
- **Dynamics Gap：** friction、mass、actuator response、latency。
- **Sensor Gap：** noise 和 calibration。

#### Q45. Sim2Real 常见方法有哪些？

**核心回答：** 扩大仿真训练分布，学习稳健表示，再用少量真实数据做适配。

- **Domain Randomization：** 随机 texture、lighting、camera、friction、mass 等因素。
- **Representation Learning：** 学习对外观变化更稳定，同时保留 geometry、motion 和 object structure 的 feature。
- **Real Data Fine-tuning：** 用少量真实机器人数据适配 simulation-trained policy。
- **Online Adaptation：** 部署时更新 dynamics model、latent state 或 policy adapter。

## 16. 中文版：控制与部署

#### Q46. VLA 推理只有 3 Hz，但机器人控制需要 50 Hz，怎么办？

**核心回答：** 用 hierarchical control。

VLA 在低频层输出 target pose、waypoint、trajectory 或 action chunk，低层 controller 高频跟踪：

\[
\text{VLA}
\rightarrow
\text{Target or Trajectory}
\rightarrow
\text{OSC, MPC, or Impedance Controller}
\rightarrow
\text{Motor Command}
\]

VLA 负责语义决策和短期规划，低层 controller 负责高频 feedback 和物理稳定性。

#### Q47. 机械臂为什么会抖？怎么解决？

**核心回答：** 抖动可能来自 policy 输出不连续、视觉噪声、control gain 太激进，或者 inference 和 communication latency 不稳定。

常见方法有 action chunking、temporal ensemble、smoothness regularization、low-pass filter、impedance control、MPC，以及 velocity 或 acceleration constraint。

例如：

\[
L=
L_{action}
+
\lambda_v\|a_t-a_{t-1}\|^2
\]

#### Q48. ONNX、TensorRT、Triton 怎么区分？

**核心回答：** 三者位于部署栈的不同层级。

- **ONNX：** 模型交换格式，ONNX Runtime 是 inference runtime。
- **TensorRT：** NVIDIA GPU 高性能 inference engine，负责 graph optimization、低精度计算和 kernel 优化。
- **Triton Inference Server：** serving 层，负责 request、batching、concurrency、scheduling 和多模型后端。

常见云端结构：

\[
\text{Model}
\rightarrow
\text{TensorRT}
\rightarrow
\text{Triton Serving}
\]

#### Q49. INT8 量化掉精度怎么办？

**核心回答：** 改善 calibration、对敏感层保留高精度，或者进行 Quantization-Aware Training。

常见方法：

- calibration data 要覆盖真实 deployment distribution。
- 敏感层保留 FP16 或 BF16，其余使用 INT8。
- QAT 在训练阶段模拟量化误差，让模型提前适应。

#### Q50. KV Cache 对 VLA 有什么用？

**核心回答：** 当 VLA 有明显的 autoregressive token decoding 时，KV Cache 可以减少重复计算。

Transformer 每生成一个新 token 时，可以复用前面 token 已经计算好的 Key 和 Value。

如果 policy 一次 forward 直接输出 action chunk，或者主要使用 Diffusion 或 Flow Matching，传统 LLM 风格 KV Cache 的收益会更小。

#### Q51. Batching 和 Latency 怎么权衡？

**核心回答：** batch 越大通常 throughput 和 GPU utilization 越高，但等待凑 batch 会增加单请求 latency。

机器人 edge deployment 常用 batch size 1，因为实时响应最重要。多机器人 cloud serving 可以通过 dynamic batching 提升吞吐。

#### Q52. CPU、GPU、NPU 怎么选？

**核心回答：** 看算子支持、延迟、吞吐、功耗和部署环境。

- **CPU：** compatibility 好，部署简单，大模型 latency 较高。
- **GPU：** Transformer 支持成熟，kernel 和 CUDA 生态完整，吞吐高。
- **NPU：** 功耗效率高，但更依赖 compiler、operator coverage 和具体 model graph。

## 17. 中文版：场景题

#### Q53. 新机器人自由度、传感器和控制频率都不同，怎么迁移 VLA？

**核心回答：** 先对齐 observation，再尽量使用共享 action interface，最后加入 embodiment-specific 适配。

可以分五层：

1. **Observation Adapter：** 对齐 image format、camera representation 和 proprioception。
2. **Shared Action Representation：** 适合时预测 end-effector motion 等更通用接口。
3. **Kinematic Mapping：** 用 IK 或低层 controller 把 end-effector command 转成 joint command。
4. **Embodiment Adapter：** 增加 robot-specific action head 或 adapter。
5. **Few-Shot Fine-tuning：** 用少量新机器人数据更新 LoRA、adapter 或 action head。

#### Q54. 全新任务只有少量示教，怎么快速泛化？

**核心回答：** 最大化复用 pretrained perception、language understanding 和 manipulation prior，只适配最必要的参数。

常见办法有 LoRA、action-head fine-tuning、adapter tuning、skill composition，以及在模型支持时使用 demonstration context 做 in-context robot learning。

长任务可以拆成：

\[
\text{Locate}
\rightarrow
\text{Open}
\rightarrow
\text{Grasp}
\rightarrow
\text{Place}
\]

高层 planner 组合 skill，低层 VLA 或 policy 执行具体动作。

#### Q55. 为什么 VLA 还需要传统 Controller？

**核心回答：** VLA 和传统 controller 负责不同时间尺度的问题。

VLA 擅长 perception、language grounding、semantic reasoning 和 action generation。传统 controller 擅长 high-frequency feedback、stability 和 dynamics compensation。

典型结构：

\[
\text{VLA}
\rightarrow
\text{Trajectory or Target}
\rightarrow
\text{Controller}
\rightarrow
\text{Robot}
\]

#### Q56. Cross-Embodiment 真正难在哪里？

**核心回答：** 同一个 skill 必须在不同物理身体和控制接口上仍然有一致语义。

困难包括 kinematics、workspace、camera viewpoint、gripper geometry、action frequency、joint limits 和 controller semantics 都不同。

因此好的系统会把 shared task structure 和 embodiment-specific execution 分开建模。

## 18. 中文版：面试时的五层总框架

遇到一个新的 VLA 面试题，可以先判断它属于哪一层：

1. **Perception：机器人看到了什么？**  
   关键词：CLIP、SigLIP、DINO、Depth、3D、Multi-view。

2. **Representation and Reasoning：模型内部提取并组织了什么信息？**  
   关键词：VLM、Grounding、Attention、World Model、Geometry、Semantics。

3. **Action Generation：动作怎么表示和生成？**  
   关键词：Action Token、Continuous Action、Autoregressive、Diffusion、Flow Matching、Action Chunking。

4. **Control：生成出来的目标怎么稳定执行？**  
   关键词：IK、OSC、MPC、Impedance Control、Receding Horizon。

5. **Learning and Deployment：模型怎么学会，又怎么部署？**  
   关键词：BC、RL、Offline RL、Sim2Real、Cross-Embodiment、Quantization、TensorRT。

最终可以把整个 VLA 系统记成：

\[
\boxed{
\text{Perception}
\rightarrow
\text{Representation}
\rightarrow
\text{Reasoning}
\rightarrow
\text{Action}
\rightarrow
\text{Control}
}
\]

训练、适配和系统部署围绕这条主链展开。

## References and version notes

[^openvla]: *OpenVLA: An Open-Source Vision-Language-Action Model*. arXiv:2406.09246. First submitted June 2024, revised September 2024. Supports the OpenVLA architecture, DINOv2 and SigLIP visual fusion, autoregressive action-token prediction, and low-rank adaptation discussion.

[^rt1]: *RT-1: Robotics Transformer for Real-World Control at Scale*. arXiv:2212.06817. First submitted December 2022. Supports the RT-1 description as a large-scale multi-task robot policy using tokenized inputs and actions.

[^rt2]: *RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control*. arXiv:2307.15818, published at CoRL 2023. Supports joint training on web-scale vision-language tasks and robot trajectories, with robot actions represented as tokens.

[^octo]: *Octo: An Open-Source Generalist Robot Policy*. arXiv:2405.12213. First submitted May 2024. Supports Octo as a generalist Transformer policy trained on 800k Open X-Embodiment trajectories and adapted to new robot setups.

[^act]: *Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware*. arXiv:2304.13705. First submitted April 2023. Introduces Action Chunking with Transformers and sequence-level action prediction for fine manipulation.

[^diffusion-policy]: *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*. arXiv:2303.04137. First submitted March 2023. Supports conditional action diffusion, multimodal action distributions, visual conditioning, and receding-horizon control.

[^flow-matching]: *Flow Matching for Generative Modeling*. arXiv:2210.02747. First submitted October 2022. Introduces Flow Matching as vector-field regression for continuous normalizing flows and distinguishes general probability paths from Optimal Transport paths.

[^rotation6d]: *On the Continuity of Rotation Representations in Neural Networks*. arXiv:1812.07035. First submitted December 2018. Supports the continuity limitations of common low-dimensional rotation representations and the use of continuous 5D and 6D representations.

[^ppo]: *Proximal Policy Optimization Algorithms*. arXiv:1707.06347. First submitted July 2017. Supports PPO's surrogate objective and repeated minibatch optimization on newly sampled interaction data.

[^gae]: *High-Dimensional Continuous Control Using Generalized Advantage Estimation*. arXiv:1506.02438. First submitted June 2015. Supports GAE as an exponentially weighted advantage estimator that trades bias against variance.

[^sac]: *Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor*. arXiv:1801.01290. First submitted January 2018. Supports SAC as an off-policy maximum-entropy stochastic actor-critic method.

[^td3]: *Addressing Function Approximation Error in Actor-Critic Methods*. arXiv:1802.09477. First submitted February 2018. Supports the twin-critic, delayed-update, and target-smoothing mechanisms associated with TD3.
