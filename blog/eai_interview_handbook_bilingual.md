---
title: Embodied AI Engineering Interview Handbook
subtitle: A Bilingual Q&A on VLA, World Action Models, Training Systems, RL Post-Training, and Deployment
date: 2026-09-25
description: An English and Chinese interview review guide for embodied AI engineer roles in VLA and WAM pre-training, from action tokenizers and flow matching to world models, large-scale training, RL post-training, evaluation, and deployment.
tags: [Interview, VLA, WAM, RL, Engineering]
lang: en
---

# Embodied AI Engineering Interview Handbook

*A fast review guide for embodied AI engineer interviews in VLA and WAM pre-training. The highlighted box under each question is the sentence to say first. The text below it adds only what an interviewer is likely to probe. Full formulas appear only where interviewers commonly ask you to write them, and short arrow diagrams show how the pieces connect.*

## 1. English Edition: VLA Fundamentals

#### Q1. What is the main difference between a VLA and a standard LLM?

> **Core answer:** An LLM predicts language tokens. A VLA maps images, a language instruction, and robot state to executable robot actions.

\[
\text{Vision + Language + Robot State}\rightarrow\text{Action}
\]

Inputs usually include one or more RGB cameras, the instruction, and proprioception such as joint angles, end-effector pose, and gripper width. Outputs can be discrete action tokens, continuous actions, or an action chunk. The vision-language backbone brings semantic knowledge from web data, and robot data teaches the model how that knowledge becomes motion.

#### Q2. What are observation and action tokenizers?

> **Core answer:** The observation tokenizer turns sensor input into tokens the backbone can read. The action tokenizer turns robot actions into something the model can predict.

Images usually go through a pretrained encoder such as SigLIP or DINOv2 and stay as continuous patch embeddings. Robot state is projected by a small MLP into one or a few state tokens. On the action side there are three families.

- **Binning:** Split each action dimension into uniform intervals and predict the interval ID as a token. OpenVLA uses `256` bins per dimension between the 1st and 99th percentiles of the data, so outliers do not waste resolution. [^openvla]
- **Compressed tokens:** Compress a whole action chunk before discretizing it, as FAST does with a frequency transform, or learn a VQ codebook.
- **Continuous actions:** Predict real values directly with a regression head, a diffusion model, or a flow model.

#### Q3. How does the FAST action tokenizer work, and why does it help?

> **Core answer:** FAST applies a DCT to each action dimension over the chunk, quantizes the coefficients, and compresses them with BPE. This removes the redundancy between neighboring timesteps. [^fast]

\[
\text{Action Chunk}\rightarrow\text{DCT}\rightarrow\text{Quantize}\rightarrow\text{BPE}\rightarrow\text{Action Tokens}
\]

At high control frequency, per-step binning produces many highly correlated tokens. Each token carries little new information, and the model learns to copy the previous token. After the DCT, most of the energy sits in a few low-frequency coefficients, so the sequence becomes short and informative. π0-FAST uses this to train an autoregressive VLA on high-frequency dexterous data.

#### Q4. How do you design the action space?

> **Core answer:** Choose the control target, the reference frame, and absolute or relative actions, and keep all three identical between training and deployment.

- **Joint space or end-effector space:** Joint actions map directly to the robot but are tied to one embodiment. End-effector actions transfer better across arms but need IK and can hit singularities.
- **Absolute or delta:** Delta actions relative to the current pose generalize better across the workspace but can drift. Absolute targets avoid drift but depend on consistent calibration. Many chunked policies express the whole chunk relative to the pose at the start of the chunk.
- **Reference frame:** The base, camera, and end-effector frames each change what the model must learn. A frame mismatch is one of the most common silent bugs.
- **Gripper:** Usually handled as a separate binary or continuous dimension.

#### Q5. Why and how do you normalize actions and proprioception?

> **Core answer:** Dimensions have very different scales, so without normalization the loss is dominated by the largest dimensions and binning wastes resolution.

The standard practice is per-dimension normalization with dataset statistics, either mean and standard deviation or the 1st and 99th percentiles mapped to \([-1,1]\). Statistics are usually computed separately for each robot or dataset. They must be saved with the checkpoint and used to unnormalize at deployment. Loading the wrong statistics is the classic cause of a robot moving in the right direction with the wrong magnitude.

## 2. English Edition: Transformer and Generative Model Basics

#### Q6. Write the attention formula. Why divide by \(\sqrt{d_k}\)?

> **Core answer:** Attention weights the values by a softmax over scaled query and key dot products. The scaling keeps the logits at unit scale so the softmax does not saturate.

\[
\mathrm{Attention}(Q,K,V)=\mathrm{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
\]

If the entries of \(Q\) and \(K\) have unit variance, their dot product has variance \(d_k\). Large logits saturate the softmax and make gradients vanish. Compute and memory grow quadratically with sequence length, which is why visual token count matters so much for VLAs.

#### Q7. What are MHA, MQA, and GQA? What problem does FlashAttention solve?

> **Core answer:** They differ in how many query heads share one set of keys and values. FlashAttention makes exact attention faster by cutting memory traffic.

MHA gives every query head its own K and V. MQA shares a single K and V across all heads. GQA sits in between, with each group of query heads sharing one K and V. Fewer KV heads mean a smaller KV cache and faster decoding with little quality loss. [^gqa]

FlashAttention computes attention in tiles that fit in on-chip SRAM and never writes the full \(N\times N\) score matrix to GPU memory. The result is exact, faster, and uses memory linear in sequence length. [^flashattention]

#### Q8. What are RoPE, Pre-LN, and RMSNorm?

> **Core answer:** RoPE encodes position by rotating queries and keys, so their dot product depends only on relative position. Pre-LN and RMSNorm are the standard choices for training deep Transformers stably.

RoPE extends naturally to 2D or 3D positions, which suits image patches and video tokens. Pre-LN normalizes before each sublayer and keeps a clean residual path, so it trains more stably than the original Post-LN. RMSNorm drops the mean subtraction of LayerNorm and only rescales by the root mean square, which is cheaper and works as well in practice.

#### Q9. What is a VAE, and how does VQ-VAE differ?

> **Core answer:** A VAE encodes an input into a continuous latent distribution and is trained with a reconstruction loss plus a KL term that pulls the latent toward a simple prior. VQ-VAE replaces the latent with the nearest entry in a learned codebook, which gives discrete tokens.

Continuous VAE latents are the standard input space for latent diffusion image and video models, including most video-based world models. VQ tokens suit autoregressive Transformers, for example a latent action codebook. A common VQ failure is codebook collapse, where only a few codes get used. Code resets, EMA updates, and lower code dimensions help. [^vae]

#### Q10. Explain DDPM training in one line. What do DDIM and classifier-free guidance add?

> **Core answer:** DDPM adds Gaussian noise to clean data at a random noise level and trains the network to predict that noise.

\[
x_t=\sqrt{\bar\alpha_t}\,x_0+\sqrt{1-\bar\alpha_t}\,\epsilon,\qquad
\mathcal L=\|\epsilon-\epsilon_\theta(x_t,t,c)\|^2
\]

DDIM reuses the same trained model with a deterministic sampler that skips steps, so sampling can drop from hundreds of steps to around ten. [^ddim] Classifier-free guidance randomly drops the condition during training, then at sampling extrapolates from the unconditional prediction toward the conditional one. It strengthens conditioning but doubles the forward passes per step. [^cfg]

#### Q11. What is Flow Matching? Write its training objective.

> **Core answer:** Flow Matching learns a velocity field that moves samples from noise to data along a chosen path. Generation integrates that field with an ODE solver.

With the common straight-line path between noise \(x_0\) and data \(x_1\):

\[
x_t=(1-t)\,x_0+t\,x_1,\qquad
\mathcal L=\|v_\theta(x_t,t,c)-(x_1-x_0)\|^2
\]

For a robot policy, \(x\) is the whole action chunk and \(c\) is the observation and instruction. Papers differ in which end they call \(t=0\), so state your convention in the interview. [^flow-matching] The whole method fits in a few lines.

```python
# Training step. x1 is the ground truth action chunk with shape [B, H, D].
x0 = torch.randn_like(x1)
t = torch.rand(x1.shape[0], 1, 1)
xt = (1 - t) * x0 + t * x1
loss = ((model(xt, t, obs) - (x1 - x0)) ** 2).mean()

# Sampling with 10 Euler steps.
x = torch.randn(B, H, D)
for i in range(10):
    t = torch.full((B, 1, 1), i / 10)
    x = x + model(x, t, obs) / 10
```

#### Q12. Diffusion or Flow Matching?

> **Core answer:** Both turn noise into samples from a multimodal distribution. Diffusion is usually trained to predict noise along a stochastic noising process, while Flow Matching directly regresses a velocity along a chosen, often straight, path.

Straight paths are easier to integrate, so flow policies often need only about `10` steps. π0 uses 10 integration steps, for example. Actual speed still depends on the solver, distillation, and architecture, and under matched design choices the two families are closely related.

## 3. English Edition: Visual and Multimodal Representation

#### Q13. CLIP, DINO, or SigLIP for robotics?

> **Core answer:** CLIP and SigLIP are strong at semantics aligned with language. DINOv2 is strong at spatial structure and correspondence. Manipulation needs both, so many VLAs fuse them.

| Encoder | Training signal | Strength | Weakness |
|---|---|---|---|
| CLIP | Softmax contrastive loss over the batch | Open-vocabulary semantics | Weaker fine geometry |
| SigLIP | Per-pair sigmoid loss, no batch-wide normalization | Semantics, scales better than CLIP | Weaker fine geometry |
| DINOv2 | Self-supervised, no text | Precise patch geometry and correspondence | No language alignment |

OpenVLA concatenates DINOv2 and SigLIP features for exactly this reason. [^openvla]

#### Q14. MLP projector or Perceiver Resampler?

> **Core answer:** An MLP projector maps each visual token into the language model's embedding space and keeps the token count. A Perceiver Resampler uses a fixed set of learnable queries that cross-attend to the visual tokens, so it also compresses them to a fixed number.

\[
z_i^{vision}\rightarrow\mathrm{MLP}\rightarrow z_i^{LLM}\qquad\qquad Q_{learned}\xrightarrow{\text{cross-attention}}\text{Visual Tokens}
\]

The MLP keeps the most detail and is the default in LLaVA-style models. The resampler bounds context length and latency but can lose fine spatial detail. Where vision enters the model is a separate choice. Feeding visual tokens only at the input is cheapest, while inserting cross-attention every few layers, as Flamingo does, gives the language model repeated access to vision at a higher cost.

#### Q15. How do you handle token explosion from high-resolution or multi-view images?

> **Core answer:** Keep the tokens that matter for control and compress the rest.

A ViT produces \((H/P)\times(W/P)\) patch tokens, so doubling resolution quadruples the count, and every extra camera or history frame adds a full set. Common tools are token pooling or merging, a resampler, a low-resolution global view, high-resolution crops around the gripper or target, and fewer history frames. A wrist camera often provides fine detail more cheaply than a higher-resolution third-person view.

#### Q16. How do you keep geometric detail after ViT downsampling?

> **Core answer:** Fuse features from several layers and add geometry-aware inputs or supervision.

\[
F=\mathrm{Fuse}(F_{early},F_{middle},F_{late})
\]

Early layers keep edges and local position, and late layers keep semantics, so multi-layer fusion keeps both. Auxiliary tasks such as depth, optical flow, segmentation, or keypoint correspondence push the representation to retain geometry. Explicit 3D inputs such as depth maps or point clouds help when precise positioning matters.

#### Q17. How do you fuse multiple cameras?

> **Core answer:** Encode each view, tell the model which camera each token came from, then fuse.

\[
\text{Camera}_i\rightarrow\text{Encoder}\rightarrow\text{Tokens}_i+\text{Camera Embedding}_i
\]

The simplest approach adds a learned camera embedding to each view's tokens and concatenates them. Camera intrinsics and extrinsics give the model the true geometric relation between views. A more geometric approach lifts features from all views into a shared 3D or bird's-eye representation before fusion.

#### Q18. How does the model ground language, including "put this on that"?

> **Core answer:** Cross-modal attention links words to image regions, and ambiguous references are resolved with visual context and history.

\[
\text{red cup}\leftrightarrow\text{image region}\qquad\qquad\text{drawer}\leftrightarrow\text{image region}
\]

Object-centric features, region features, or segmentation supervision strengthen the link between a phrase such as "red cup" and a specific region. For "this" and "that", the model relies on pointing cues, object tracking, and dialogue history. A deployed system should ask for clarification when several objects remain equally plausible.

## 4. English Edition: Action Representation and Generation

#### Q19. Discrete action tokens or continuous actions?

> **Core answer:** Both usually represent the same physical command. Discrete tokens reuse the language model head and cross-entropy training. Continuous outputs keep full precision and suit diffusion or flow heads.

\[
\text{Discrete: }a\rightarrow\mathrm{bin}(a)\rightarrow\text{token}\qquad\qquad\text{Continuous: }z\rightarrow\text{Action Head}\rightarrow a
\]

Discrete tokens add quantization error, and per-step binning adds long autoregressive decoding. A continuous head trained with plain MSE regresses to the conditional mean, which fails when several actions are valid, so continuous VLAs usually pair with diffusion or flow heads. Hierarchical systems mix both, with a discrete skill choice on top and continuous motion below.

#### Q20. Why is plain MSE a problem for multimodal demonstrations?

> **Core answer:** MSE learns the average of all valid actions, and the average of two valid actions can be invalid.

\[
A_{avg}\approx\frac{A_L+A_R}{2}
\]

If half the demonstrations pass an obstacle on the left, \(A_L\), and half on the right, \(A_R\), MSE predicts their average, a path through the middle that collides. Generative heads such as diffusion, flow matching, a CVAE, or a discretized distribution put probability on both modes and sample one coherent trajectory.

#### Q21. Why are Euler angles a poor learning target, and what should you use?

> **Core answer:** Euler angles suffer from gimbal lock, wraparound discontinuities, and order conventions. The 6D representation is continuous and usually learns best.

| Representation | Size | Main problem |
|---|---|---|
| Euler angles | 3 | Gimbal lock, \(179^\circ\) and \(-179^\circ\) look \(358^\circ\) apart to the loss, order conventions |
| Quaternion | 4 | \(q\) and \(-q\) are the same rotation, output must be normalized |
| 6D | 6 | None for learning, needs a Gram-Schmidt step to recover the matrix |

The 6D representation predicts two 3D vectors and orthonormalizes them to form the first two columns of a rotation matrix, and their cross product gives the third. Zhou et al. showed that every rotation representation with four or fewer dimensions is discontinuous for neural networks. [^rotation6d]

#### Q22. Autoregressive decoding or parallel prediction? Is ACT autoregressive?

> **Core answer:** An autoregressive policy predicts action tokens one by one, each conditioned on the earlier ones. A parallel policy predicts the whole chunk in one pass. ACT predicts its chunk in parallel, so it is not autoregressive over actions.

Autoregressive decoding reuses LLM machinery, but latency grows with the number of tokens and early errors propagate. OpenVLA decodes 7 action tokens per step this way. [^openvla] ACT uses a Transformer decoder with one query per future step and is trained as a conditional VAE to capture the variation in human demonstrations. At inference it sets the latent to the prior mean. [^act]

#### Q23. What is an action chunk, and how do you execute it?

> **Core answer:** An action chunk is a short sequence of future actions predicted together. It reduces compounding error, smooths motion, and cuts how often the model must run.

\[
o_t\rightarrow a_t\qquad\text{vs.}\qquad o_t\rightarrow[a_t,a_{t+1},\ldots,a_{t+H-1}]
\]

Executing a whole chunk open loop reacts slowly to surprises, and there are two common fixes. **Receding horizon** predicts \(H\) steps, executes the first few, then replans. **Temporal ensembling**, used by ACT, queries the policy every step and averages all overlapping predictions for the current step with exponential weights. [^act] Chunk length trades smoothness against reactivity.

#### Q24. What is Diffusion Policy?

> **Core answer:** Diffusion Policy represents the policy as a conditional denoising process over an action chunk. It starts from Gaussian noise and iteratively denoises it into an action sequence, conditioned on the observation.

\[
A^K\sim\mathcal N(0,I)\rightarrow A^{K-1}\rightarrow\cdots\rightarrow A^0
\]

Its strengths are multimodality, stable training, and smooth chunked output. The paper uses a 1D temporal CNN with FiLM conditioning or a Transformer as the denoiser and executes with receding-horizon control. [^diffusion-policy] Its main cost is the latency of many denoising steps, which is usually reduced with DDIM, fewer steps, or distillation.

#### Q25. How do you avoid pauses and jumps between action chunks at deployment?

> **Core answer:** Run inference asynchronously while the current chunk executes, and make the new chunk consistent with the actions that will already have been executed.

With synchronous inference the robot stops while the model thinks. With naive asynchronous inference the new chunk can disagree with the old one at the switch point and cause a jump. Real-Time Chunking treats the next chunk as an inpainting problem. Actions that will run during the inference delay are frozen, overlapping actions are softly guided toward the old plan, and the flow model fills in the rest. [^rtc] Simpler alternatives are blending the overlap or conditioning on the previous chunk.

## 5. English Edition: Classic VLA Architectures

#### Q26. What are RT-1, RT-2, and OpenVLA?

> **Core answer:** RT-1 showed that a Transformer trained on large real robot data generalizes across tasks. RT-2 showed that co-fine-tuning a web-scale VLM with robot data transfers web knowledge to control. OpenVLA is an open 7B model in the RT-2 style.

\[
\text{Visual Tokens + Language Tokens}\rightarrow\text{LLM}\rightarrow\text{Action Tokens}
\]

RT-1 uses an EfficientNet image encoder with token compression and outputs discretized actions. [^rt1] RT-2 writes actions as text-like tokens and trains on web vision-language data together with robot trajectories. [^rt2] OpenVLA uses Llama 2 with fused DINOv2 and SigLIP features, is trained on about `970k` Open X-Embodiment trajectories, and supports LoRA fine-tuning. [^openvla]

#### Q27. What is Octo, and what is cross-embodiment learning?

> **Core answer:** Octo is a generalist Transformer policy pretrained on 800k Open X-Embodiment trajectories and built to be fine-tuned to new robots, sensors, and action spaces. Cross-embodiment learning trains one model on data from many different robots so that they share skills. [^octo]

\[
\text{Many Tasks + Many Embodiments}\rightarrow\text{Reusable Policy Initialization}
\]

\[
\text{Shared Representation}\rightarrow\text{Robot-Specific Adapter}\rightarrow\text{Robot Action}
\]

Robots differ in DoF, kinematics, camera placement, gripper, and control frequency. The usual recipe keeps a shared backbone and adds embodiment-specific input and output layers, or maps every robot into a common action space such as end-effector deltas with padding. Octo uses a diffusion action head, and Open X-Embodiment provides the pooled multi-robot data. [^oxe]

#### Q28. What is the architecture of π0?

> **Core answer:** π0 combines a pretrained VLM with a separate action expert that generates continuous action chunks by flow matching. [^pi0]

\[
\text{VLM Prefix (images + text)}\rightarrow\text{Action Expert (state + noisy actions)}\xrightarrow{\text{10 flow steps}}\text{Action Chunk}
\]

The VLM, a `3B` PaliGemma, processes images and language. A smaller action expert of about `300M` parameters takes the robot state and noisy actions and attends to the VLM's tokens inside the same Transformer. The attention mask is blockwise causal.

| Query block | Sees images and text | Sees state | Sees noisy actions |
|---|---|---|---|
| Images and text | Yes | No | No |
| State | Yes | Yes | No |
| Noisy actions | Yes | Yes | Yes |

Because the image and text prefix never sees later blocks, the pretrained VLM is preserved and its cache can be reused across all denoising steps. The model outputs `50`-step chunks, supports control at up to 50 Hz, and uses `10` flow integration steps.

#### Q29. What do π0.5 and knowledge insulation add?

> **Core answer:** π0.5 improves open-world generalization through co-training on heterogeneous data and a high-level step that predicts the next subtask in language. Knowledge insulation stops the action expert's gradients from damaging the VLM backbone. [^pi05] [^ki]

π0.5 trains on data from many robots, web vision-language tasks, and high-level subtask annotations. At inference it first predicts a subtask such as "pick up the plate", then generates low-level actions for it. Knowledge insulation trains the backbone on FAST action tokens and vision-language data, while the flow action expert learns continuous actions behind a stop-gradient into the backbone. Training is faster, language following is preserved, and inference still produces fast continuous actions.

#### Q30. Why co-train a VLA with vision-language data?

> **Core answer:** Fine-tuning only on robot data makes the VLM forget its semantic knowledge, which hurts language following and generalization.

Robot data is narrow, with few objects, few scenes, and short templated instructions. Mixing in captioning, VQA, and grounding data keeps the backbone's open-world knowledge. A lower backbone learning rate, LoRA, or gradient isolation from the action head helps in the same way.

#### Q31. What is a dual-system VLA such as GR00T N1?

> **Core answer:** A slow VLM, often called System 2, interprets the scene and instruction. A fast action module, often called System 1, generates motor commands at high frequency. [^gr00t]

\[
\text{VLM (slow)}\rightarrow\text{Latent Plan}\rightarrow\text{DiT Action Head (fast)}\rightarrow\text{Motor Commands}
\]

In GR00T N1 the VLM's representations feed a diffusion Transformer action head through cross-attention, and the head is trained with flow matching. Training mixes real robot data, synthetic data, and human videos whose missing actions are filled with latent actions or inverse dynamics pseudo-labels. The design separates semantic reasoning, which can run slowly, from reactive control, which must run fast.

## 6. English Edition: World Models and WAM Pre-Training

#### Q32. What is a world model?

> **Core answer:** A world model predicts how the environment will change, usually given the current observation and an action. It can serve as a simulator, a planner, or a source of representations for a policy.

Three families come up in interviews.

- **Pixel or video generation models:** Predict future frames, usually with a diffusion Transformer over VAE latents. Cosmos is an example. [^cosmos]
- **Latent dynamics models:** Predict compact latent states and rewards, and learn behavior inside imagined rollouts. Dreamer is the classic example. [^dreamer]
- **Predictive embedding models:** Predict future representations instead of pixels, as V-JEPA 2 does, so no capacity is spent on irrelevant appearance. [^vjepa2]

#### Q33. What is a WAM, and how does it differ from a VLA?

> **Core answer:** A world action model learns future world states and robot actions jointly, usually in one backbone. A standard VLA learns only the mapping from observation to action.

\[
z_t\rightarrow\text{Shared World Backbone}\rightarrow\begin{cases}\text{Future State}\\\text{Robot Action}\end{cases}
\]

A VLA inherits its prior from a vision-language model, which knows what things are. A WAM usually inherits its prior from a video model, which knows how things move and interact. Future prediction gives dense supervision on every pixel or latent, while action labels are sparse and expensive. OpenWAM frames WAM design as choices about representation, backbone, information flow, inference procedure, and data. [^openwam]

#### Q34. Why should video pre-training help robot actions?

> **Core answer:** Video is abundant and shows physics, object interaction, and cause and effect. A policy needs exactly this knowledge, and robot data alone cannot supply it at scale.

\[
\text{Unlabeled Video}\rightarrow\text{Dynamics-Aware Representation}\xrightarrow{\text{a little robot data}}\text{Action}
\]

Predicting the future forces the model to encode object positions, contacts, and motion, not just categories. Human and robot videos without action labels still count as training data. The action head then needs far less robot data to learn how to act on that representation. The main risk is that video prediction also spends capacity on texture and lighting, which do not matter for control.

#### Q35. What are the main WAM architectures?

> **Core answer:** There are three main patterns. They differ in whether the future is generated explicitly and how actions read from it.

| Pattern | How actions are produced | Future at test time | Examples |
|---|---|---|---|
| Video first, then inverse dynamics | Generate a future video, then infer the actions that produce it | Explicit video | UniPi [^unipi] |
| Joint video and action backbone | One Transformer predicts future frames or latents together with actions | Optional | GR-1, GR-2, UVA [^gr1] [^gr2] [^uva] |
| Implicit future | Future prediction only shapes the representation, or features are read without full frames | None | FLARE, Video Prediction Policy [^flare] [^vpp] |

#### Q36. Does a WAM need to generate the future at test time?

> **Core answer:** Often not. Recent evidence suggests most of the benefit comes from video co-training shaping the representation, not from imagining the future at inference.

Fast-WAM finds that removing video co-training hurts far more than removing test-time future generation, and skipping generation cuts latency sharply. [^fastwam] UVA similarly uses separate video and action heads so it can skip video decoding when only actions are needed. [^uva] Explicit imagination still has value when the predicted future is used for planning, verification, or human inspection.

#### Q37. How does a WAM connect video tokens and action tokens?

> **Core answer:** Through the attention mask and through how each stream is noised during training.

Action tokens usually attend to current and predicted video tokens, and whether video tokens see actions is a design choice. If video tokens see actions, the model is action-conditioned and can act as a simulator. If actions never see future tokens, future prediction shapes only the shared weights and can be dropped at inference. Diffusion-style WAMs often give video and actions independent noise levels, an idea from Diffusion Forcing. [^diffusion-forcing] The same model then plays different roles depending on what is noised.

| Video tokens | Action tokens | The model acts as |
|---|---|---|
| Clean current frame, noisy future | Noisy | Policy with imagination |
| Clean current and future frames | Noisy | Inverse dynamics model |
| Clean current frame, noisy future | Clean | Action-conditioned simulator |

UVA trains these roles together with masking. [^uva]

#### Q38. VAE latents or JEPA latents for a WAM?

> **Core answer:** VAE latents come with pretrained video generators and can be decoded to pixels, but they are optimized for reconstruction. JEPA latents are optimized for prediction, so they keep more of the structure that matters for control and less appearance detail.

A reconstruction objective rewards texture and lighting as much as object pose. A predictive objective in embedding space rewards only what can be predicted from context. The cost is that JEPA latents cannot be decoded for visualization and cannot directly reuse a pretrained video generator. The companion note [Reconstruct or Predict?](vae_jepa_wam.md) discusses this in depth.

#### Q39. How do you use video that has no action labels?

> **Core answer:** Either infer pseudo-actions with an inverse dynamics model or learn latent actions directly from frame changes.

\[
(o_t,\,o_{t+1})\rightarrow\text{IDM}\rightarrow\hat a_t
\]

- **Inverse dynamics pseudo-labels:** Train an IDM on a small labeled set to predict the action between two frames, then label a large unlabeled corpus. VPT did this for Minecraft. [^vpt]
- **Latent actions:** Train a model to explain the change from frame \(t\) to frame \(t+1\) with a small discrete code. Genie and LAPA pretrain on these latent actions, then learn a mapping to real robot actions from a little labeled data. [^genie] [^lapa]
- **Video prediction pre-training:** Pretrain the WAM's video branch on unlabeled video, then attach the action head.

A world model can also generate new videos that an IDM then labels, which creates synthetic training data. DreamGen follows this idea. [^dreamgen]

#### Q40. How would you build a WAM pre-training data pipeline?

> **Core answer:** Combine large unlabeled video with a smaller set of action-labeled robot data, standardize everything, filter hard, and control the mixture.

1. **Sources:** Egocentric human video, internet manipulation video, robot video with and without actions, and simulation.
2. **Standardize:** Resample to a common frame rate and control frequency, align timestamps between cameras and joint states, and unify camera names and action conventions.
3. **Filter:** Remove static clips, camera shake, scene cuts, and failed or idle segments. Check action statistics for outliers.
4. **Annotate:** Add or rewrite instructions with a VLM and split long episodes into subtasks.
5. **Precompute:** Encode frames into VAE latents offline and store them in shards, because video decoding is often the throughput bottleneck.
6. **Mix:** Set sampling weights per source rather than per episode count, so a huge but low-value source does not dominate.

#### Q41. How do you balance the video loss and the action loss?

> **Core answer:** Weight them so that neither dominates, and watch the downstream action metric rather than the total loss.

Video latents have far more elements than actions, so a naive sum lets the video term dominate. Normalize each loss by its element count, then tune the weight on the action term. One common schedule pretrains on video alone and then trains jointly. Another trains jointly from the start with a larger video weight early on. Track action error or rollout success, because a lower video loss does not guarantee better actions.

#### Q42. How do you evaluate a world model?

> **Core answer:** Measure visual quality, action controllability, and physical consistency, and above all check whether it improves the downstream policy.

Visual metrics such as FVD, PSNR, SSIM, and LPIPS mainly reward appearance, so they are weak signals for control. Better checks ask whether the predicted future changes correctly when the action changes, whether objects persist and contacts stay plausible over long rollouts, and whether the model's predicted success correlates with real success when it is used as a policy evaluator. The final test is policy success on real or simulated tasks.

#### Q43. How do you cut WAM inference latency?

> **Core answer:** Avoid generating pixels, use few sampling steps, and cache or reuse computation.

The main levers are skipping future frame decoding at inference, reading features from a single denoising pass, predicting future latents at low resolution or low frame rate, distilling to few steps, caching the observation prefix, and executing chunks asynchronously.

## 7. English Edition: Large-Scale Training Engineering

#### Q44. How much GPU memory does training a 7B model take?

> **Core answer:** With mixed precision and Adam, about `16 bytes` per parameter before activations, so roughly `112 GB` for a 7B model.

That is 2 bytes for BF16 weights, 2 for gradients, and 12 for FP32 optimizer state, which holds a master copy of the weights and the two Adam moments. [^zero] Activations come on top and grow with batch size, sequence length, and depth. This is why a 7B model cannot be fully trained on a single 80 GB GPU without sharding.

#### Q45. What are DDP, ZeRO, FSDP, and tensor or pipeline parallelism?

> **Core answer:** DDP replicates the whole model on every GPU and averages gradients. ZeRO and FSDP shard the model state across GPUs to save memory. Tensor and pipeline parallelism split the model itself.

| Method | What is split across GPUs | When to use it |
|---|---|---|
| DDP | Only the data | The model fits on one GPU |
| ZeRO 1 | Optimizer states | Cheap first saving |
| ZeRO 2 | Optimizer states and gradients | Medium models |
| ZeRO 3 or FSDP | Optimizer states, gradients, and parameters | The model does not fit on one GPU |
| Tensor parallel | Matrix multiplications inside a layer | Very wide layers, fast links inside one node |
| Pipeline parallel | Groups of layers, fed with micro-batches | Very deep models across nodes |

For VLA or WAM models between 1B and 10B parameters, FSDP or ZeRO 3 with activation checkpointing is usually enough. [^zero]

#### Q46. BF16 or FP16? What are activation checkpointing and gradient accumulation?

> **Core answer:** BF16 has the same exponent range as FP32, so it rarely overflows and needs no loss scaling. FP16 has more mantissa precision but needs loss scaling to prevent gradient underflow.

Activation checkpointing stores only some activations and recomputes the rest during the backward pass, trading about a third more compute for much less memory. Gradient accumulation sums gradients over several micro-batches before one optimizer step, which gives a large effective batch on limited memory.

#### Q47. Training throughput is low. How do you find the bottleneck?

> **Core answer:** Use a profiler to see whether the GPU is waiting on data, on communication, or on its own kernels before changing anything.

- **Data:** GPU utilization drops periodically. Video decoding and augmentation on the CPU are the usual culprits. Precompute latents, add workers and prefetching, and store data in sequential shards.
- **Communication:** Much time goes to `all-reduce` or `all-gather`. Overlap communication with compute, use larger buckets, or avoid sharding across slow links.
- **Compute:** The GPU is busy but MFU is low. Use FlashAttention, fused kernels, `torch.compile`, and larger micro-batches, and use sequence packing to avoid wasted padding.

#### Q48. The loss spikes or diverges. What do you check?

> **Core answer:** Check the data first, then the learning rate and numerical stability.

Look for corrupted samples, unnormalized actions, or `NaN` values in the batch that caused the spike. Then add learning rate warmup, lower the peak learning rate, clip gradients, and give pretrained parts a smaller learning rate. Also check for FP16 overflow, growing attention logits, and weight decay wrongly applied to norm layers or biases.

## 8. English Edition: Data and Imitation Learning

#### Q49. How is robot data collected?

> **Core answer:** Mostly by teleoperation, with a trade-off between data quality, cost, and how closely the data matches the deployed robot.

Leader-follower arms such as ALOHA give precise joint-space data for bimanual tasks. [^act] VR and motion capture scale to humanoids and dexterous hands. Handheld grippers such as UMI collect data without a robot, which is cheap but requires the gripper and camera to match the deployed robot. [^umi] Human video is the cheapest source but has no robot actions. Simulation is unlimited but has a sim-to-real gap.

#### Q50. What goes wrong when you mix data from many robots and datasets?

> **Core answer:** Action spaces, frames, frequencies, and camera setups are inconsistent, and the datasets are imbalanced.

Standardize action conventions or add embodiment-specific heads, and normalize statistics per dataset. Resample to a shared control frequency or give the frequency to the model as an input. Pad missing cameras or dimensions and mask them in the loss. Reweight datasets so that large but repetitive ones do not dominate, and hold out whole tasks or scenes for evaluation.

#### Q51. What is covariate shift in behavior cloning, and how do you address it?

> **Core answer:** A cloned policy makes small errors that lead to states the expert never visited, where it makes larger errors, so mistakes compound over time.

Remedies include DAgger, where an expert labels the states the policy actually visits, recovery demonstrations that start from perturbed states, noise injection during data collection, and action chunking, which reduces the number of decision points. [^dagger] [^act]

#### Q52. What is causal confusion, also called the copycat problem?

> **Core answer:** The policy learns a shortcut from a feature that correlates with the expert action but does not cause it. Most often it copies the previous action from proprioception or history.

In smooth demonstrations the next action is very close to the current state, so the model learns to continue the current motion and ignores vision. It then fails to start, stop, or react. [^causal-confusion] Remedies include dropping or adding noise to proprioception and history, using fewer history frames, and checking that performance truly depends on the image.

#### Q53. You only have 100 demonstrations. What do you do?

> **Core answer:** Start from a pretrained policy or VLA, adapt as few parameters as possible, augment carefully, and spend new data collection on the failures.

1. Fine-tune a pretrained generalist with LoRA or only the action head.
2. Use augmentations that keep action labels valid, such as color jitter and small crops, and avoid flips that change the meaning of the action.
3. Deploy, find the failure states, and collect targeted demonstrations there.
4. Add RL or human-in-the-loop correction once safe interaction is available.

#### Q54. What does grounding pretrained knowledge to actions mean, and how is it done?

> **Core answer:** It means connecting what a pretrained model knows about scenes and language to the specific motor commands of one robot.

\[
\text{Visual-Language Representation}\rightarrow\text{Executable Robot Action}
\]

The options run from light to heavy. Freeze the backbone and train only an action head. Train LoRA or adapters together with the head. Fine-tune the whole model on action tokens. Attach a diffusion or flow action expert to the backbone. Or pretrain on video to learn dynamics first and then learn the action mapping from robot data. Lighter options need less data but transfer less.

#### Q55. Should failed trajectories be kept?

> **Core answer:** Yes, but never as positive imitation targets.

Behavior cloning copies whatever it sees, so failed actions teach failure. Failures are valuable for training success detectors, value functions, and reward models, as negatives in preference learning, and for advantage-conditioned training that tells the policy which data was good. [^recap]

#### Q56. What is the Sim2Real gap, and how do you close it?

> **Core answer:** Simulation and reality differ in appearance, dynamics, and sensing. You close the gap by widening the simulated distribution, learning representations that ignore irrelevant differences, and adapting with real data.

\[
P_{sim}(o,a,s')\neq P_{real}(o,a,s')
\]

Visual gaps come from texture, lighting, and cameras. Dynamics gaps come from friction, mass, actuator response, and latency. Sensor gaps come from noise and calibration. The main tools are domain randomization, system identification to match the simulator to the real robot, co-training on simulated and real data, and online adaptation of a latent dynamics estimate.

## 9. English Edition: Reinforcement Learning and Post-Training

#### Q57. What is PPO? Write the clipped objective.

> **Core answer:** PPO is an on-policy policy gradient method that limits how far each update moves the policy away from the one that collected the data.

\[
L^{CLIP}=\mathbb E\left[\min\left(r_tA_t,\ \mathrm{clip}(r_t,1-\epsilon,1+\epsilon)A_t\right)\right],
\qquad r_t=\frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{old}}(a_t|s_t)}
\]

Once the ratio leaves \([1-\epsilon,1+\epsilon]\) in the direction the advantage favors, the objective stops rewarding further change, so one batch cannot push the policy too far. PPO collects a batch, runs several epochs of minibatch updates, then collects fresh data. [^ppo]

#### Q58. What does GAE do?

> **Core answer:** GAE estimates the advantage as an exponentially weighted sum of TD errors, and \(\lambda\) trades bias against variance.

\[
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t),\qquad
A_t=\sum_{l\ge 0}(\gamma\lambda)^l\,\delta_{t+l}
\]

With \(\lambda=0\) it is the one-step TD error, which has low variance but inherits the bias of the value estimate. With \(\lambda=1\) it becomes the Monte Carlo return minus the baseline, which is unbiased but noisy. Values around `0.95` are typical. [^gae]

#### Q59. What is GRPO, and how does it differ from PPO?

> **Core answer:** GRPO drops the value network. It samples a group of outputs for the same input and uses each output's reward, normalized within the group, as its advantage. [^grpo]

The advantage is the reward minus the group mean, divided by the group standard deviation. The PPO-style clipped ratio and a KL penalty toward a reference model are kept. This removes the memory cost and instability of a critic and works well with sparse outcome rewards. In robotics it requires resetting to the same initial state many times, which is easy in simulation and hard in the real world.

#### Q60. PPO, SAC, or TD3? What are a replay buffer and offline RL?

> **Core answer:** PPO is on-policy and discards old data. SAC and TD3 are off-policy and reuse old data from a replay buffer. Offline RL learns only from a fixed dataset with no new interaction.

\[
\text{Environment}\rightarrow\text{Replay Buffer}\rightarrow\text{Training}\rightarrow\text{Environment}
\]

| Method | Data | Policy | Key idea |
|---|---|---|---|
| PPO | Fresh on-policy batches | Stochastic | Clipped ratio keeps updates small [^ppo] |
| SAC | Replay buffer | Stochastic | Maximizes reward plus entropy for exploration [^sac] |
| TD3 | Replay buffer | Deterministic | Twin critics, delayed actor, target smoothing [^td3] |
| Offline RL, such as IQL or CQL | Fixed dataset | Either | Stays close to the data to avoid overestimating unseen actions |

A replay buffer stores transitions of state, action, reward, and next state, so each real interaction serves many updates. Use PPO when simulation is cheap and massively parallel, as in locomotion. Use off-policy methods when real samples are expensive.

#### Q61. Why is RL fine-tuning of a VLA hard, and what are the main approaches?

> **Core answer:** Rewards are sparse, real resets are slow and unsafe, and diffusion or flow policies have no cheap action likelihood for policy gradients.

- **Token-based VLAs:** Apply PPO or GRPO directly on action token probabilities, usually in simulation.
- **Flow or diffusion policies:** Turn the denoising chain into a stochastic process with Gaussian steps so every step has a likelihood, as Flow-GRPO does for image models. [^flow-grpo] Alternatively, learn a small residual policy or a policy over the initial noise instead of updating the whole model.
- **Off-policy RL with a human in the loop:** HIL-SERL combines demonstrations, human interventions, and off-policy RL to reach high success rates on real robots. [^hil-serl]
- **Advantage-conditioned training:** Learn a value function, label each data segment as better or worse, and train the policy conditioned on that label. π*0.6 does this with its RECAP method, which combines demonstrations, autonomous experience, and expert corrections. [^recap]

#### Q62. Where does the reward come from in real-world robot RL?

> **Core answer:** Usually from a learned success classifier or a VLM judge, because hand-designed rewards need state that real robots cannot measure.

A binary success detector trained on a few hundred labeled images is the most common choice. VLM rewards generalize across tasks but can be noisy and exploitable. Progress estimators give denser signals. Reward hacking is a real risk, so inspect rollouts yourself.

## 10. English Edition: Control and Deployment

#### Q63. How do you connect a 3 Hz VLA to a controller running at 50 Hz or faster?

> **Core answer:** Use a hierarchy. The VLA outputs a chunk or target at low frequency, and a low-level controller tracks it at high frequency with feedback.

\[
\text{VLA}\rightarrow\text{Target or Trajectory}\rightarrow\text{OSC, MPC, or Impedance Controller}\rightarrow\text{Motor Command}
\]

```text
VLA               3 to 10 Hz       images + instruction  ->  action chunk or target pose
Chunk queue       every tick       interpolate           ->  next setpoint
Controller        50 to 1000 Hz    PD, impedance, OSC    ->  joint torques
```

The VLA handles semantics and short-horizon planning. The controller handles stability and contact. Chunking and asynchronous execution keep the robot moving between VLA calls.

#### Q64. What are PD control, IK, impedance control, OSC, and MPC?

> **Core answer:** They are the standard low-level tools that turn a target into motor commands.

- **PD control:** Torque is a position error term plus a velocity error term. It is the simplest tracking controller.
- **IK:** Computes the joint angles that reach a desired end-effector pose.
- **Impedance control:** Makes the arm behave like a spring and damper around the target, so contact stays gentle and safe.
- **OSC:** Controls end-effector motion directly in task space using the robot's dynamics model.
- **MPC:** Solves a short-horizon constrained optimization at every control step.

#### Q65. Why does the arm jitter, and how do you fix it?

> **Core answer:** Jitter comes from inconsistent consecutive predictions, perception noise, aggressive gains, or irregular latency.

Use action chunking with temporal ensembling or smooth chunk transitions, low-pass filtering, velocity and acceleration limits, a smoothness penalty on consecutive actions during training, softer impedance gains, and a fixed-rate control loop that does not depend on inference timing.

#### Q66. How do you reduce VLA inference latency?

> **Core answer:** Reduce the tokens, reduce the steps, and optimize the runtime.

Use fewer visual tokens, cache the observation prefix, cut flow or diffusion steps or distill to few steps, and prefer parallel chunk decoding over long autoregressive decoding. On the runtime side, use BF16 or quantization, TensorRT, `torch.compile`, and CUDA Graphs. Asynchronous execution hides whatever latency remains.

#### Q67. How do ONNX, TensorRT, and Triton differ?

> **Core answer:** ONNX is a model exchange format, TensorRT is NVIDIA's optimizing inference engine, and Triton is a serving system.

\[
\text{PyTorch}\rightarrow\text{ONNX}\rightarrow\text{TensorRT}\rightarrow\text{Triton Serving}
\]

TensorRT fuses layers, selects kernels, and runs in FP16 or INT8. Triton handles requests, dynamic batching, concurrency, and multiple models. A typical path exports a PyTorch model to ONNX, builds a TensorRT engine, and serves it with Triton.

#### Q68. INT8 quantization hurts accuracy. What do you do?

> **Core answer:** Improve calibration, keep sensitive layers in higher precision, or use quantization-aware training.

Calibrate on real deployment data. Keep the action head, normalization layers, and layers with activation outliers in FP16 or BF16. Weight-only quantization, with INT8 or INT4 weights and FP16 activations, is a safer first step. If accuracy still drops, fine-tune with quantization-aware training.

#### Q69. When does KV cache help a VLA, and how do batching and hardware matter?

> **Core answer:** KV cache helps whenever tokens are decoded one at a time or the same prefix is reused, as in iterative denoising with an action expert.

Autoregressive VLAs cache the keys and values of earlier tokens. Flow VLAs such as π0 compute the image and language prefix once and reuse its cache across all denoising steps. Large batches raise throughput but add waiting time, so a single robot uses batch size 1 while a cloud service for a robot fleet uses dynamic batching. GPUs have the most mature support. Edge NPUs save power but depend on operator coverage.

## 11. English Edition: Evaluation and Debugging

#### Q70. How do you evaluate a VLA?

> **Core answer:** Use simulation benchmarks for fast iteration, real-robot trials with a fixed protocol for final decisions, and always report uncertainty.

Common benchmarks are LIBERO for multi-task and long-horizon manipulation, SimplerEnv for simulated evaluation that tracks real-robot results, and CALVIN for long-horizon language-conditioned tasks. [^libero] [^simpler] [^calvin] Offline validation loss often correlates poorly with success, so it cannot replace rollouts. Test generalization along separate axes such as new objects, positions, lighting, backgrounds, and instructions.

#### Q71. How many real-robot trials are enough?

> **Core answer:** Usually more than people run. A success rate is a binomial estimate, so a small number of trials gives wide error bars.

With 20 trials and a true success rate of 50%, the 95% confidence interval is roughly `±22` points. Two policies that score 60% and 70% over 20 trials are therefore not reliably different. Use the same initial conditions for both policies, randomize their order, run blind when possible, and report the number of trials.

#### Q72. The policy works in training but fails on the real robot. What do you check?

> **Core answer:** Rule out pipeline mismatches first, since they cause most failures, before blaming the model.

1. **Normalization:** Are the deployment action and state statistics the same as in training?
2. **Conventions:** Are the action frame, delta or absolute mode, rotation format, and gripper encoding identical?
3. **Cameras:** Are the view order, resolution, crop, color channel order, and calibration identical?
4. **Timing:** Is the control frequency the same, and does latency make observations stale?
5. **Replay test:** Replay a training episode's recorded actions on the robot. If that fails, the problem is in the robot interface, not the policy.
6. **Offline check:** Feed recorded training observations to the deployed model and compare its outputs with the recorded actions.

## 12. English Edition: Scenario Questions

#### Q73. How do you transfer a VLA to a new robot with different DoF, sensors, and control frequency?

> **Core answer:** Align the observations, use a shared action interface where possible, add an embodiment-specific head, and fine-tune on a small target dataset.

Map the cameras and proprioception into the input format the model expects. Predict end-effector actions and convert them with IK, or add a new action head for the new joint space. Resample the data to the new control frequency or adjust the chunk length. Start from a few hundred demonstrations and fine-tune with LoRA or the head only.

#### Q74. How do you handle a long-horizon task?

> **Core answer:** Split it into subtasks, let a high-level planner choose the next subtask, and let a low-level policy execute it while progress is checked.

\[
\text{Locate}\rightarrow\text{Open}\rightarrow\text{Grasp}\rightarrow\text{Place}
\]

The planner can be a separate VLM or the VLA itself predicting a language subtask, as in π0.5. [^pi05] Add success detection after each subtask, with retry or recovery behavior on failure. Memory of past steps matters when the current image does not reveal task progress.

#### Q75. You are asked to design a WAM pre-training project from scratch. What is your plan?

> **Core answer:** Start from a pretrained video model, pretrain on mixed video with a light action head, run small ablations early, and judge every decision by downstream policy success.

1. **Backbone:** A pretrained video diffusion Transformer with its VAE, or a JEPA encoder with a predictor.
2. **Data:** A large pool of egocentric and robot video plus a smaller action-labeled robot set, standardized and filtered as in Q40.
3. **Objective:** Joint future prediction and action loss, with independent noise levels so the model can also run as a policy alone.
4. **Inference:** Plan to skip explicit video generation at test time and measure latency from the first day.
5. **Evaluation:** Fixed simulation benchmarks plus a small real-robot suite, with ablations of video co-training, data mixture, and representation.

#### Q76. Why does a VLA still need a conventional controller?

> **Core answer:** They solve problems at different time scales. The VLA decides what to do and roughly how, and the controller guarantees stable, safe, high-frequency execution.

A VLA running at a few hertz cannot react to contact forces within milliseconds. Joint limits, collision checks, and force limits also belong in the controller and should never depend on a learned model.

## 13. English Edition: Five-Layer Answer Framework

When a question looks unfamiliar, first place it in one of five layers, then answer from that layer.

| Layer | Question it answers | Keywords |
|---|---|---|
| Perception | What does the robot observe? | Cameras, depth, proprioception, visual encoders |
| Representation | What does the model keep? | Semantics, geometry, dynamics, world models |
| Action generation | How is the action represented and sampled? | Tokens, chunks, diffusion, flow matching |
| Control | How is the action executed stably? | Controllers, frequency, smoothing |
| Learning and deployment | How is the system trained, evaluated, and served? | Data, pre-training, RL, Sim2Real, inference |

\[
\boxed{\text{Perception}\rightarrow\text{Representation}\rightarrow\text{Reasoning}\rightarrow\text{Action}\rightarrow\text{Control}}
\]

Training, adaptation, and deployment determine how each layer becomes usable on a real robot.

*本部分与英文版编号一一对应。每题下方的高亮框就是面试时应该先说出口的结论，后面只补面试官最可能追问的细节。*

## 14. 中文版：VLA 基础

#### Q1. VLA 和普通 LLM 的核心区别是什么？

> **核心回答：** LLM 预测语言 token，VLA 把图像、语言指令和机器人状态映射成可执行的机器人动作。

\[
\text{Vision + Language + Robot State}\rightarrow\text{Action}
\]

输入通常包括一个或多个 RGB 相机、语言指令，以及关节角、末端位姿、夹爪开合等 proprioception。输出可以是离散 action token、连续动作或 action chunk。视觉语言 backbone 带来 web 数据里的语义知识，机器人数据负责教模型把这些知识变成动作。

#### Q2. Observation tokenizer 和 action tokenizer 分别是什么？

> **核心回答：** Observation tokenizer 把传感器输入变成 backbone 能读的 token，action tokenizer 把机器人动作变成模型能预测的形式。

图像一般经过 SigLIP、DINOv2 这类预训练编码器，保持为连续的 patch embedding。机器人状态用一个小 MLP 投影成一个或几个 state token。动作侧主要有三类。

- **Binning：** 把每个动作维度均匀切成若干区间，预测区间编号。OpenVLA 在数据的第 1 到第 99 百分位之间每维切 `256` 个 bin，避免离群值浪费分辨率。 [^openvla]
- **压缩 token：** 先把整段 action chunk 压缩再离散化，比如 FAST 用频域变换，或者学一个 VQ codebook。
- **连续动作：** 直接预测实数，接回归头、Diffusion 或 Flow Matching。

#### Q3. FAST tokenizer 怎么做？为什么有用？

> **核心回答：** FAST 对 chunk 内每个动作维度做 DCT，把系数量化后再用 BPE 压缩，从而去掉相邻时间步之间的冗余。 [^fast]

\[
\text{Action Chunk}\rightarrow\text{DCT}\rightarrow\text{Quantize}\rightarrow\text{BPE}\rightarrow\text{Action Tokens}
\]

控制频率很高时，逐步 binning 会产生大量高度相关的 token。每个 token 带来的新信息很少，模型容易学成“复制上一个 token”。做完 DCT 后，大部分能量集中在少数低频系数上，序列变短，信息密度变高。π0-FAST 就靠它在高频灵巧操作数据上训练自回归 VLA。

#### Q4. 动作空间怎么设计？

> **核心回答：** 要确定控制对象、参考坐标系、绝对还是相对动作，并且这三点在训练和部署时必须完全一致。

- **关节空间还是末端空间：** 关节动作直接对应机器人，但和本体绑定。末端动作更容易跨机械臂迁移，但需要 IK，也可能遇到奇异位形。
- **绝对还是增量：** 相对当前位姿的增量动作在工作区不同位置泛化更好，但会累积漂移。绝对目标没有漂移，但依赖一致的标定。很多 chunk 策略会把整段动作都表示成相对 chunk 起点位姿的量。
- **参考坐标系：** base、相机、末端坐标系下模型要学的东西不一样。坐标系不一致是最常见的隐蔽 bug 之一。
- **夹爪：** 通常单独作为一个二值或连续维度处理。

#### Q5. 为什么要对动作和本体状态做归一化？怎么做？

> **核心回答：** 不同维度的量纲差别很大，不归一化时 loss 会被数值最大的维度主导，binning 也会浪费分辨率。

标准做法是用数据集统计量逐维归一化，可以用均值和标准差，也可以把第 1 和第 99 百分位映射到 \([-1,1]\)。统计量通常按机器人或数据集分别计算，要和 checkpoint 一起保存，部署时用同一套统计量反归一化。加载错统计量是“方向对但幅度不对”的经典原因。

## 15. 中文版：Transformer 与生成模型基础

#### Q6. 写出 attention 公式。为什么要除以 \(\sqrt{d_k}\)？

> **核心回答：** Attention 用缩放后的 query 和 key 点积做 softmax，再对 value 加权。缩放是为了让 logit 保持单位尺度，避免 softmax 饱和。

\[
\mathrm{Attention}(Q,K,V)=\mathrm{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
\]

如果 \(Q\) 和 \(K\) 的每个元素方差为 1，它们点积的方差就是 \(d_k\)。logit 太大会让 softmax 饱和，梯度接近消失。计算量和显存随序列长度平方增长，所以视觉 token 数对 VLA 特别关键。

#### Q7. MHA、MQA、GQA 有什么区别？FlashAttention 解决什么问题？

> **核心回答：** 三者的区别在于多少个 query head 共享同一组 key 和 value。FlashAttention 通过减少显存读写来加速精确 attention。

MHA 的每个 query head 都有自己的 K 和 V。MQA 让所有 head 共享一组 K 和 V。GQA 介于两者之间，每组 query head 共享一组 K 和 V。KV head 越少，KV cache 越小，解码越快，质量损失很小。 [^gqa]

FlashAttention 把 attention 分块放进片上 SRAM 计算，不把完整的 \(N\times N\) 分数矩阵写回显存。结果仍然精确，速度更快，显存随序列长度线性增长。 [^flashattention]

#### Q8. RoPE、Pre-LN、RMSNorm 分别是什么？

> **核心回答：** RoPE 通过旋转 query 和 key 来编码位置，使它们的点积只依赖相对位置。Pre-LN 和 RMSNorm 是稳定训练深层 Transformer 的标配。

RoPE 很容易扩展到 2D 或 3D 位置，适合图像 patch 和视频 token。Pre-LN 在每个子层之前做归一化，保留干净的残差通路，比原始的 Post-LN 更稳定。RMSNorm 去掉了 LayerNorm 的减均值，只按均方根缩放，更省计算，效果基本一样。

#### Q9. VAE 是什么？VQ-VAE 有什么不同？

> **核心回答：** VAE 把输入编码成连续的潜变量分布，用重建 loss 加一个把分布拉向简单先验的 KL 项来训练。VQ-VAE 把潜变量替换成 codebook 里最近的条目，得到离散 token。

连续 VAE latent 是 latent diffusion 图像和视频模型的标准输入空间，大多数基于视频的 world model 也用它。VQ token 适合自回归 Transformer，例如 latent action codebook。VQ 的常见问题是 codebook collapse，也就是只有少数 code 被用到，可以用 code 重置、EMA 更新和降低 code 维度来缓解。 [^vae]

#### Q10. 一句话说清 DDPM 训练。DDIM 和 classifier-free guidance 又做了什么？

> **核心回答：** DDPM 在随机噪声强度下给干净数据加高斯噪声，训练网络预测这份噪声。

\[
x_t=\sqrt{\bar\alpha_t}\,x_0+\sqrt{1-\bar\alpha_t}\,\epsilon,\qquad
\mathcal L=\|\epsilon-\epsilon_\theta(x_t,t,c)\|^2
\]

DDIM 复用同一个训练好的模型，换成可以跳步的确定性采样器，采样步数能从几百步降到十步左右。 [^ddim] Classifier-free guidance 训练时随机丢掉条件，采样时从无条件预测朝条件预测的方向外推。它能加强条件控制，但每一步的 forward 次数翻倍。 [^cfg]

#### Q11. Flow Matching 是什么？写出训练目标。

> **核心回答：** Flow Matching 学一个速度场，把样本沿选定路径从噪声搬到数据，生成时用 ODE solver 沿这个速度场积分。

采用噪声 \(x_0\) 和数据 \(x_1\) 之间最常见的直线路径：

\[
x_t=(1-t)\,x_0+t\,x_1,\qquad
\mathcal L=\|v_\theta(x_t,t,c)-(x_1-x_0)\|^2
\]

在机器人 policy 里，\(x\) 是整段 action chunk，\(c\) 是观测和指令。不同论文对哪一端叫 \(t=0\) 的约定不同，面试时先说明自己的约定。 [^flow-matching] 整个方法几行代码就能写完。

```python
# 训练一步。x1 是真实 action chunk，形状 [B, H, D]。
x0 = torch.randn_like(x1)
t = torch.rand(x1.shape[0], 1, 1)
xt = (1 - t) * x0 + t * x1
loss = ((model(xt, t, obs) - (x1 - x0)) ** 2).mean()

# 采样，10 步 Euler 积分。
x = torch.randn(B, H, D)
for i in range(10):
    t = torch.full((B, 1, 1), i / 10)
    x = x + model(x, t, obs) / 10
```

#### Q12. Diffusion 和 Flow Matching 怎么比较？

> **核心回答：** 两者都能把噪声变成多峰分布的样本。Diffusion 通常沿随机加噪过程预测噪声，Flow Matching 直接沿选定的、通常是直线的路径回归速度。

直线路径更好积分，所以 flow policy 常常 `10` 步左右就够，比如 π0 用 10 步积分。真实速度仍然取决于 solver、蒸馏和架构，在设计选择匹配时两类方法本质上很接近。

## 16. 中文版：视觉与多模态表征

#### Q13. 机器人该用 CLIP、DINO 还是 SigLIP？

> **核心回答：** CLIP 和 SigLIP 擅长和语言对齐的语义，DINOv2 擅长空间结构和对应关系。操作任务两者都需要，所以很多 VLA 会把它们融合起来。

| 编码器 | 训练信号 | 优势 | 短板 |
|---|---|---|---|
| CLIP | batch 内 softmax 对比损失 | 开放词汇语义 | 精细几何较弱 |
| SigLIP | 逐对 sigmoid 损失，不需要跨 batch 归一化 | 语义强，扩展性比 CLIP 好 | 精细几何较弱 |
| DINOv2 | 自监督，没有文本 | patch 几何和对应关系精确 | 没有语言对齐 |

OpenVLA 正是因此把 DINOv2 和 SigLIP 特征拼接起来。 [^openvla]

#### Q14. MLP projector 和 Perceiver Resampler 有什么区别？

> **核心回答：** MLP projector 只把每个视觉 token 映射到语言模型的 embedding 空间，token 数不变。Perceiver Resampler 用固定数量的可学习 query 对视觉 token 做 cross-attention，所以还能把 token 压缩到固定数量。

\[
z_i^{vision}\rightarrow\mathrm{MLP}\rightarrow z_i^{LLM}\qquad\qquad Q_{learned}\xrightarrow{\text{cross-attention}}\text{Visual Tokens}
\]

MLP 保留的细节最多，是 LLaVA 类模型的默认做法。Resampler 能限制上下文长度和延迟，但可能丢掉精细的空间信息。视觉信息从哪里进入模型是另一个选择。只在输入端拼接视觉 token 最便宜，像 Flamingo 那样每隔几层插入 cross-attention，能让语言模型反复访问视觉信息，代价也更高。

#### Q15. 高分辨率或多视角带来 token 爆炸怎么办？

> **核心回答：** 保留对控制重要的 token，压缩其余部分。

ViT 会产生 \((H/P)\times(W/P)\) 个 patch token，分辨率翻倍 token 数就变成四倍，每多一个相机或一帧历史又多一整份。常用手段有 token pooling 或 merging、resampler、全局视角用低分辨率、夹爪和目标附近用高分辨率裁剪，以及减少历史帧。腕部相机往往比提高第三视角分辨率更省地提供精细信息。

#### Q16. ViT 下采样后怎么保留几何细节？

> **核心回答：** 融合多层特征，并加入几何相关的输入或监督。

\[
F=\mathrm{Fuse}(F_{early},F_{middle},F_{late})
\]

浅层保留边缘和局部位置，深层保留语义，多层融合可以两者兼得。深度、光流、分割、关键点对应等辅助任务会逼表征保留几何信息。需要精确定位时，深度图或点云这类显式 3D 输入也很有帮助。

#### Q17. 多相机怎么融合？

> **核心回答：** 每个视角分别编码，告诉模型每个 token 来自哪台相机，再做融合。

\[
\text{Camera}_i\rightarrow\text{Encoder}\rightarrow\text{Tokens}_i+\text{Camera Embedding}_i
\]

最简单的做法是给每个视角的 token 加一个可学习的 camera embedding 再拼接。相机内外参能给模型提供视角之间真实的几何关系。更几何化的做法是先把所有视角的特征提升到统一的 3D 或 BEV 表示里再融合。

#### Q18. 模型怎么做语言 grounding，包括“把这个放到那个上面”这种指代？

> **核心回答：** 跨模态 attention 把词和图像区域联系起来，指代歧义靠视觉上下文和历史信息消解。

\[
\text{red cup}\leftrightarrow\text{image region}\qquad\qquad\text{drawer}\leftrightarrow\text{image region}
\]

Object-centric 特征、区域特征或分割监督能加强“红色杯子”这类短语和具体区域之间的对应。遇到“这个”“那个”时，模型要依靠指向线索、目标跟踪和对话历史。部署时如果多个物体同样合理，系统应该主动请用户澄清。

## 17. 中文版：动作表示与生成

#### Q19. 离散 action token 还是连续动作？

> **核心回答：** 两者通常表示的是同一个物理指令。离散 token 可以复用语言模型的输出头和交叉熵训练，连续输出保留完整精度，适合接 Diffusion 或 Flow 头。

\[
\text{Discrete: }a\rightarrow\mathrm{bin}(a)\rightarrow\text{token}\qquad\qquad\text{Continuous: }z\rightarrow\text{Action Head}\rightarrow a
\]

离散 token 会引入量化误差，逐步 binning 还会带来很长的自回归解码。连续头如果只用 MSE 训练，会回归到条件均值，多个动作都正确时就会出错，所以连续 VLA 一般配 Diffusion 或 Flow 头。分层系统可以两者混用，上层离散地选 skill，下层连续地出轨迹。

#### Q20. 为什么多峰示教数据不能直接用 MSE？

> **核心回答：** MSE 学到的是所有正确动作的平均值，而两个正确动作的平均值可能是错的。

\[
A_{avg}\approx\frac{A_L+A_R}{2}
\]

如果一半示教从左边绕开障碍物，记作 \(A_L\)，一半从右边绕，记作 \(A_R\)，MSE 会预测两者的平均，也就是从中间穿过去，直接撞上。Diffusion、Flow Matching、CVAE 或离散化分布这类生成式头能给两个 mode 都分配概率，再采样出一条完整一致的轨迹。

#### Q21. 为什么欧拉角不适合做学习目标？该用什么？

> **核心回答：** 欧拉角有万向节锁、角度跳变和旋转顺序约定三个问题。6D 表示是连续的，通常学得最好。

| 表示 | 维度 | 主要问题 |
|---|---|---|
| 欧拉角 | 3 | 万向节锁，\(179^\circ\) 和 \(-179^\circ\) 在 loss 看来差 \(358^\circ\)，依赖旋转顺序 |
| 四元数 | 4 | \(q\) 和 \(-q\) 是同一个旋转，输出要归一化 |
| 6D | 6 | 对学习没有问题，需要一步 Gram-Schmidt 恢复旋转矩阵 |

6D 表示预测两个 3D 向量，正交化后得到旋转矩阵的前两列，第三列由两者叉乘得到。Zhou 等人证明了 4 维及以下的旋转表示对神经网络来说都不连续。 [^rotation6d]

#### Q22. 自回归解码和并行预测有什么区别？ACT 是自回归的吗？

> **核心回答：** 自回归 policy 逐个预测 action token，每个 token 都以前面的 token 为条件。并行 policy 一次 forward 输出整段 chunk。ACT 并行预测整段 chunk，所以在动作上不是自回归的。

自回归可以直接复用 LLM 的解码机制，但延迟随 token 数增长，早期错误还会向后传播。OpenVLA 每一步就是这样解码 7 个 action token。 [^openvla] ACT 用 Transformer decoder 为每个未来时间步放一个 query，并以 conditional VAE 的方式训练，用来刻画人类示教的多样性，推理时把 latent 设为先验均值。 [^act]

#### Q23. Action chunk 是什么？怎么执行？

> **核心回答：** Action chunk 是一次预测出来的一小段未来动作。它能减少误差累积，让动作更平滑，也降低模型的调用频率。

\[
o_t\rightarrow a_t\qquad\text{vs.}\qquad o_t\rightarrow[a_t,a_{t+1},\ldots,a_{t+H-1}]
\]

整段开环执行对意外反应很慢，常见解决办法有两个。**Receding horizon** 预测 \(H\) 步，只执行前几步就重新规划。**Temporal ensembling** 是 ACT 的做法，每一步都调用 policy，把所有覆盖当前时刻的预测按指数权重平均。 [^act] chunk 长度是在平滑性和反应速度之间做权衡。

#### Q24. Diffusion Policy 是什么？

> **核心回答：** Diffusion Policy 把 policy 表示成对 action chunk 的条件去噪过程，从高斯噪声出发，以观测为条件逐步去噪成动作序列。

\[
A^K\sim\mathcal N(0,I)\rightarrow A^{K-1}\rightarrow\cdots\rightarrow A^0
\]

它的优点是能表达多峰分布、训练稳定、输出的 chunk 平滑。原论文的去噪网络是带 FiLM 条件的 1D 时序 CNN 或 Transformer，并配合 receding horizon 执行。 [^diffusion-policy] 主要代价是多步去噪带来的推理延迟，通常用 DDIM、减少步数或蒸馏来缓解。

#### Q25. 部署时怎么避免 chunk 之间的停顿和跳变？

> **核心回答：** 在执行当前 chunk 的同时异步推理下一个 chunk，并让新 chunk 和那些肯定会被执行的动作保持一致。

同步推理时机器人要停下来等模型。朴素的异步推理可能让新旧 chunk 在切换点不一致，造成跳变。Real-Time Chunking 把下一个 chunk 当成 inpainting 问题，推理延迟期间会执行的动作被冻结，重叠部分被软约束贴近旧计划，剩余部分由 flow 模型补全。 [^rtc] 更简单的替代方案是对重叠段做插值混合，或者把上一个 chunk 作为条件输入。

## 18. 中文版：经典 VLA 架构

#### Q26. RT-1、RT-2、OpenVLA 分别是什么？

> **核心回答：** RT-1 证明了在大规模真实机器人数据上训练的 Transformer 能跨任务泛化。RT-2 证明了把 web 规模 VLM 和机器人数据一起 co-fine-tune，可以把 web 知识迁移到控制上。OpenVLA 是 RT-2 路线的 7B 开源模型。

\[
\text{Visual Tokens + Language Tokens}\rightarrow\text{LLM}\rightarrow\text{Action Tokens}
\]

RT-1 用 EfficientNet 图像编码器加 token 压缩，输出离散化动作。 [^rt1] RT-2 把动作写成类似文本的 token，在 web 视觉语言数据和机器人轨迹上联合训练。 [^rt2] OpenVLA 基于 Llama 2，融合 DINOv2 和 SigLIP 特征，在约 `97 万` 条 Open X-Embodiment 轨迹上训练，支持 LoRA 微调。 [^openvla]

#### Q27. Octo 是什么？什么是 cross-embodiment 学习？

> **核心回答：** Octo 是在 80 万条 Open X-Embodiment 轨迹上预训练的通用 Transformer policy，设计目标是方便微调到新的机器人、传感器和动作空间。Cross-embodiment 学习就是用多种机器人的数据训练同一个模型，让它们共享技能。 [^octo]

\[
\text{Many Tasks + Many Embodiments}\rightarrow\text{Reusable Policy Initialization}
\]

\[
\text{Shared Representation}\rightarrow\text{Robot-Specific Adapter}\rightarrow\text{Robot Action}
\]

不同机器人在自由度、运动学、相机位置、夹爪和控制频率上都不一样。常见做法是共享 backbone，再给每种本体配专属的输入输出层，或者把所有机器人映射到末端增量这类公共动作空间并做 padding。Octo 使用 diffusion 动作头，Open X-Embodiment 提供了汇总的多机器人数据。 [^oxe]

#### Q28. π0 的架构是什么？

> **核心回答：** π0 把预训练 VLM 和一个独立的 action expert 结合起来，action expert 用 flow matching 生成连续的 action chunk。 [^pi0]

\[
\text{VLM Prefix (images + text)}\rightarrow\text{Action Expert (state + noisy actions)}\xrightarrow{\text{10 flow steps}}\text{Action Chunk}
\]

VLM 是 `3B` 的 PaliGemma，负责处理图像和语言。更小的 action expert 约 `300M` 参数，接收机器人状态和加噪动作，在同一个 Transformer 里 attend 到 VLM 的 token。attention mask 是分块因果的。

| Query 所在块 | 能看图像和文本 | 能看状态 | 能看加噪动作 |
|---|---|---|---|
| 图像和文本 | 是 | 否 | 否 |
| 状态 | 是 | 是 | 否 |
| 加噪动作 | 是 | 是 | 是 |

图像和文本前缀永远看不到后面的块，所以预训练 VLM 不受破坏，它的 cache 也能在所有去噪步里复用。模型一次输出 `50` 步的 chunk，支持最高 50 Hz 的控制，flow 积分用 `10` 步。

#### Q29. π0.5 和 knowledge insulation 带来了什么？

> **核心回答：** π0.5 通过异构数据联合训练，加上一个用语言预测下一个子任务的高层步骤，提升了开放世界泛化。Knowledge insulation 阻止 action expert 的梯度破坏 VLM backbone。 [^pi05] [^ki]

π0.5 的训练数据包括多种机器人数据、web 视觉语言任务和高层子任务标注。推理时它先预测“拿起盘子”这样的子任务，再为这个子任务生成底层动作。Knowledge insulation 让 backbone 用 FAST action token 和视觉语言数据训练，flow action expert 学连续动作，并对 backbone 做 stop-gradient。这样训练更快，语言跟随能力得以保留，推理时仍然是快速的连续动作生成。

#### Q30. 为什么 VLA 要和视觉语言数据一起联合训练？

> **核心回答：** 只用机器人数据微调会让 VLM 遗忘语义知识，损害语言跟随和泛化能力。

机器人数据很窄，物体少、场景少、指令短而模板化。混入 captioning、VQA 和 grounding 数据可以保住 backbone 的开放世界知识。给 backbone 设更小的学习率、用 LoRA，或者隔离动作头回传的梯度，也能起到类似作用。

#### Q31. GR00T N1 这类双系统 VLA 是什么？

> **核心回答：** 慢速的 VLM 常被称为 System 2，负责理解场景和指令。快速的动作模块常被称为 System 1，负责高频生成电机指令。 [^gr00t]

\[
\text{VLM (slow)}\rightarrow\text{Latent Plan}\rightarrow\text{DiT Action Head (fast)}\rightarrow\text{Motor Commands}
\]

GR00T N1 里 VLM 输出的表征通过 cross-attention 送进 diffusion Transformer 动作头，动作头用 flow matching 训练。训练数据混合了真实机器人数据、合成数据和人类视频，视频缺失的动作用 latent action 或逆动力学伪标签补上。这种设计把可以慢一点的语义推理和必须很快的反应式控制分开。

## 19. 中文版：World Model 与 WAM 预训练

#### Q32. 什么是 world model？

> **核心回答：** World model 在给定当前观测和动作时预测环境会怎样变化，可以当仿真器、规划器，也可以给 policy 提供表征。

面试里常见三类。

- **像素或视频生成模型：** 预测未来帧，通常是在 VAE latent 上跑 diffusion Transformer，Cosmos 是例子。 [^cosmos]
- **Latent dynamics 模型：** 预测紧凑的潜状态和奖励，在想象出来的 rollout 里学习行为，经典例子是 Dreamer。 [^dreamer]
- **预测式 embedding 模型：** 预测未来表征而不是像素，比如 V-JEPA 2，不把容量浪费在无关的外观细节上。 [^vjepa2]

#### Q33. WAM 是什么？和 VLA 有什么区别？

> **核心回答：** World action model 通常在同一个 backbone 里联合学习未来世界状态和机器人动作。普通 VLA 只学从观测到动作的映射。

\[
z_t\rightarrow\text{Shared World Backbone}\rightarrow\begin{cases}\text{Future State}\\\text{Robot Action}\end{cases}
\]

VLA 的先验来自视觉语言模型，知道东西“是什么”。WAM 的先验通常来自视频模型，知道东西“怎么动、怎么相互作用”。预测未来在每个像素或 latent 上都有稠密监督，而动作标签稀疏又昂贵。OpenWAM 把 WAM 设计拆成表征、backbone、信息流、推理流程和数据几个选择。 [^openwam]

#### Q34. 为什么视频预训练能帮助机器人动作？

> **核心回答：** 视频数量巨大，里面有物理规律、物体交互和因果关系。这正是 policy 需要、而仅靠机器人数据无法大规模获得的知识。

\[
\text{Unlabeled Video}\rightarrow\text{Dynamics-Aware Representation}\xrightarrow{\text{a little robot data}}\text{Action}
\]

预测未来会逼模型编码物体位置、接触和运动，而不只是类别。没有动作标签的人类视频和机器人视频也能用上。之后动作头只需要少得多的机器人数据，就能学会基于这种表征去行动。主要风险是视频预测也会把容量花在纹理、光照这类和控制无关的细节上。

#### Q35. WAM 主要有哪几种架构？

> **核心回答：** 主要有三种，区别在于是否显式生成未来，以及动作怎样从中读取信息。

| 模式 | 动作怎么产生 | 推理时的未来 | 例子 |
|---|---|---|---|
| 先生成视频，再做逆动力学 | 先生成未来视频，再推断产生这段视频的动作 | 显式视频 | UniPi [^unipi] |
| 视频和动作共享 backbone | 一个 Transformer 同时预测未来帧或 latent 和动作 | 可选 | GR-1、GR-2、UVA [^gr1] [^gr2] [^uva] |
| 隐式未来 | 未来预测只塑造表征，或者读取特征而不生成完整画面 | 不生成 | FLARE、Video Prediction Policy [^flare] [^vpp] |

#### Q36. WAM 推理时一定要生成未来吗？

> **核心回答：** 通常不需要。近期证据表明，大部分收益来自视频联合训练对表征的塑造，而不是推理时想象未来。

Fast-WAM 发现，去掉视频联合训练造成的性能下降远大于去掉推理时的未来生成，而跳过生成能大幅降低延迟。 [^fastwam] UVA 也把视频头和动作头分开，只需要动作时可以跳过视频解码。 [^uva] 不过当预测的未来要用于规划、校验或给人检查时，显式想象仍然有价值。

#### Q37. WAM 里视频 token 和动作 token 怎么连接？

> **核心回答：** 靠 attention mask，以及训练时每一路怎么加噪。

动作 token 一般可以看到当前和预测的视频 token，视频 token 能不能看到动作则是一个设计选择。视频 token 能看到动作时，模型就是动作条件的，可以当仿真器用。动作永远看不到未来 token 时，未来预测只通过共享权重起作用，推理时可以直接去掉。Diffusion 类 WAM 常给视频和动作分配相互独立的噪声强度，这个思路来自 Diffusion Forcing。 [^diffusion-forcing] 同一个模型根据哪部分被加噪，扮演不同角色。

| 视频 token | 动作 token | 模型扮演的角色 |
|---|---|---|
| 当前帧干净，未来帧加噪 | 加噪 | 带想象的 policy |
| 当前帧和未来帧都干净 | 加噪 | 逆动力学模型 |
| 当前帧干净，未来帧加噪 | 干净 | 动作条件的仿真器 |

UVA 就是用 mask 把这几种角色放在一起训练的。 [^uva]

#### Q38. WAM 用 VAE latent 还是 JEPA latent？

> **核心回答：** VAE latent 和预训练视频生成模型配套，可以解码回像素，但它是为重建优化的。JEPA latent 为预测优化，保留更多对控制重要的结构，外观细节更少。

重建目标对纹理光照和物体位姿一视同仁，embedding 空间里的预测目标只奖励能从上下文预测出来的信息。代价是 JEPA latent 无法解码出来可视化，也不能直接复用预训练视频生成模型。更详细的讨论见 [Reconstruct or Predict?](vae_jepa_wam.md)。

#### Q39. 没有动作标签的视频怎么用？

> **核心回答：** 要么用逆动力学模型推断伪动作，要么直接从画面变化中学 latent action。

\[
(o_t,\,o_{t+1})\rightarrow\text{IDM}\rightarrow\hat a_t
\]

- **逆动力学伪标签：** 先在少量有标注数据上训练 IDM，预测两帧之间的动作，再给大量无标注视频打标签。VPT 在 Minecraft 上就是这么做的。 [^vpt]
- **Latent action：** 训练一个模型，用很小的离散 code 解释第 \(t\) 帧到第 \(t+1\) 帧的变化。Genie 和 LAPA 先在这种 latent action 上预训练，再用少量有标注数据学到真实机器人动作的映射。 [^genie] [^lapa]
- **视频预测预训练：** 先用无标注视频预训练 WAM 的视频分支，再接上动作头。

World model 还可以生成新视频，再用 IDM 标注，得到合成训练数据，DreamGen 就是这个思路。 [^dreamgen]

#### Q40. WAM 预训练的数据 pipeline 怎么搭？

> **核心回答：** 把大量无标注视频和较少的带动作机器人数据结合起来，统一格式，严格过滤，并控制好配比。

1. **来源：** 第一视角人类视频、互联网操作视频、带或不带动作的机器人视频，以及仿真数据。
2. **统一：** 重采样到统一的帧率和控制频率，对齐相机和关节状态的时间戳，统一相机命名和动作约定。
3. **过滤：** 去掉静止片段、相机抖动、镜头切换、失败或空闲片段，检查动作统计量里的离群值。
4. **标注：** 用 VLM 补充或改写指令，把长 episode 切成子任务。
5. **预计算：** 离线把帧编码成 VAE latent 并分片存储，因为视频解码常常是吞吐瓶颈。
6. **配比：** 按数据来源设采样权重，而不是按 episode 数量，避免一个量大但价值低的来源占满训练。

#### Q41. 视频 loss 和动作 loss 怎么平衡？

> **核心回答：** 加权让两者都不占绝对主导，并且盯着下游动作指标，而不是总 loss。

视频 latent 的元素数远多于动作，直接相加会让视频项压倒一切。先按元素数把两个 loss 归一化，再调动作项的权重。常见的训练安排有两种，一种是先只训视频再联合训练，另一种是一开始就联合训练、前期给视频更大的权重。要跟踪动作误差或 rollout 成功率，因为视频 loss 更低不代表动作更好。

#### Q42. World model 怎么评估？

> **核心回答：** 看视觉质量、动作可控性和物理一致性，最重要的是看它能不能提升下游 policy。

FVD、PSNR、SSIM、LPIPS 这些视觉指标主要奖励外观，对控制来说信号偏弱。更有用的检查是改变动作时预测的未来是否正确变化，长 rollout 里物体是否持续存在、接触是否合理，以及把它当 policy 评估器时预测的成功率和真实成功率是否相关。最终标准是真实或仿真任务上的 policy 成功率。

#### Q43. 怎么降低 WAM 的推理延迟？

> **核心回答：** 不生成像素，减少采样步数，缓存和复用计算。

具体手段包括推理时不解码未来帧、只从一次去噪 forward 里读取特征、用低分辨率或低帧率预测未来 latent、蒸馏成少步模型、缓存观测前缀，以及异步执行 chunk。

## 20. 中文版：大规模训练工程

#### Q44. 训练一个 7B 模型需要多少显存？

> **核心回答：** 混合精度加 Adam 时，不算激活大约每个参数 `16 字节`，7B 模型约 `112 GB`。

拆开来看，BF16 权重 2 字节，梯度 2 字节，FP32 优化器状态 12 字节，其中包括一份权重主副本和 Adam 的两个动量。 [^zero] 激活另算，随 batch size、序列长度和层数增长。所以不做切分的话，7B 模型没法在单张 80 GB 显卡上完整训练。

#### Q45. DDP、ZeRO、FSDP、张量并行和流水线并行分别是什么？

> **核心回答：** DDP 在每张卡上放完整模型并平均梯度。ZeRO 和 FSDP 把模型状态切分到多张卡上来省显存。张量并行和流水线并行切分的是模型本身。

| 方法 | 在卡间切分什么 | 适用场景 |
|---|---|---|
| DDP | 只切数据 | 模型放得进单卡 |
| ZeRO 1 | 优化器状态 | 最便宜的第一步节省 |
| ZeRO 2 | 优化器状态和梯度 | 中等规模模型 |
| ZeRO 3 或 FSDP | 优化器状态、梯度和参数 | 模型放不进单卡 |
| 张量并行 | 层内的矩阵乘法 | 层很宽，单机内高速互联 |
| 流水线并行 | 按层分组，用 micro-batch 喂数据 | 模型很深，跨机器 |

对 1B 到 10B 参数的 VLA 或 WAM，FSDP 或 ZeRO 3 加上 activation checkpointing 通常就够了。 [^zero]

#### Q46. 用 BF16 还是 FP16？Activation checkpointing 和梯度累积是什么？

> **核心回答：** BF16 的指数范围和 FP32 相同，很少溢出，不需要 loss scaling。FP16 的尾数精度更高，但需要 loss scaling 防止梯度下溢。

Activation checkpointing 只保存一部分激活，反向时重算其余部分，多花大约三分之一的计算换来大量显存节省。梯度累积把多个 micro-batch 的梯度加起来再做一次优化器更新，在显存有限时得到大的等效 batch。

#### Q47. 训练吞吐很低，怎么定位瓶颈？

> **核心回答：** 先用 profiler 判断 GPU 是在等数据、等通信还是算子本身慢，再动手改。

- **数据：** GPU 利用率周期性下降。CPU 上的视频解码和数据增强是常见元凶。可以预计算 latent，增加 worker 和预取，使用分片的顺序存储。
- **通信：** 大量时间花在 `all-reduce` 或 `all-gather` 上。让通信和计算重叠，调大 bucket，或者避免跨慢速链路切分。
- **计算：** GPU 很忙但 MFU 很低。用 FlashAttention、融合算子、`torch.compile` 和更大的 micro-batch，用 sequence packing 避免 padding 浪费。

#### Q48. Loss 突刺或发散，查什么？

> **核心回答：** 先查数据，再查学习率和数值稳定性。

先看引发突刺的 batch 里有没有损坏样本、没归一化的动作或 `NaN`。然后加学习率 warmup、调低峰值学习率、做梯度裁剪，并给预训练部分更小的学习率。还要检查 FP16 溢出、attention logit 过大，以及是否错误地对 norm 层或 bias 做了 weight decay。

## 21. 中文版：数据与模仿学习

#### Q49. 机器人数据是怎么采集的？

> **核心回答：** 主要靠遥操作，需要在数据质量、成本和与部署机器人的匹配程度之间权衡。

ALOHA 这类主从臂能为双臂任务提供精确的关节空间数据。 [^act] VR 和动捕适合人形机器人和灵巧手的规模化采集。UMI 这类手持夹爪不需要机器人就能采数据，成本低，但夹爪和相机要和部署的机器人匹配。 [^umi] 人类视频最便宜，但没有机器人动作。仿真数据无限，但存在 sim-to-real gap。

#### Q50. 混合多种机器人和数据集时会遇到什么问题？

> **核心回答：** 动作空间、坐标系、频率和相机配置不一致，数据集之间也不平衡。

统一动作约定或者加本体专属的输出头，统计量按数据集分别归一化。重采样到统一的控制频率，或者把频率作为输入告诉模型。缺失的相机或维度用 padding 补齐，并在 loss 里 mask 掉。给数据集重新加权，避免量大但重复的数据集占主导，评估时整块留出任务或场景。

#### Q51. 行为克隆里的 covariate shift 是什么？怎么解决？

> **核心回答：** 克隆出来的 policy 犯一点小错就会进入专家从没到过的状态，在那里犯更大的错，误差随时间不断累积。

解决办法包括 DAgger，也就是让专家给 policy 实际访问到的状态打标签，还有专门从扰动状态开始录制恢复示教、采集时注入噪声，以及用 action chunking 减少决策次数。 [^dagger] [^act]

#### Q52. 什么是 causal confusion，也就是 copycat 问题？

> **核心回答：** Policy 从一个和专家动作相关但并非原因的特征上学到了捷径，最常见的是从本体状态或历史里直接复制上一个动作。

平滑的示教里下一个动作和当前状态非常接近，模型于是学会“延续当前运动”而忽略视觉，结果不会启动、不会停，也不会对变化做出反应。 [^causal-confusion] 缓解办法包括丢弃本体状态和历史或者对其加噪、减少历史帧，并验证性能确实依赖图像输入。

#### Q53. 只有 100 条示教怎么办？

> **核心回答：** 从预训练 policy 或 VLA 出发，尽量少改参数，谨慎做增强，把新增采集集中在失败的地方。

1. 用 LoRA 或只训动作头来微调预训练的通用模型。
2. 只用不破坏动作标签的增强，比如颜色扰动和小幅裁剪，避免会改变动作含义的翻转。
3. 部署后找出失败状态，在那里定向补采示教。
4. 具备安全交互条件后，再加入 RL 或人在回路的纠正。

#### Q54. “把预训练知识 grounding 到动作”是什么意思？怎么做？

> **核心回答：** 就是把预训练模型对场景和语言的理解，连接到某一台机器人具体的电机指令上。

\[
\text{Visual-Language Representation}\rightarrow\text{Executable Robot Action}
\]

做法从轻到重依次是冻结 backbone 只训动作头、训练 LoRA 或 adapter 加动作头、在 action token 上全量微调、给 backbone 接一个 diffusion 或 flow action expert，以及先用视频预训练学动力学再用机器人数据学动作映射。越轻的方法需要的数据越少，能迁移的也越少。

#### Q55. 失败轨迹要不要保留？

> **核心回答：** 要保留，但绝不能当作正样本去模仿。

行为克隆看到什么就学什么，失败动作只会教会模型失败。失败轨迹适合用来训练成功检测器、价值函数和奖励模型，在偏好学习里当负样本，也可以用于 advantage-conditioned 训练，告诉 policy 哪些数据是好的。 [^recap]

#### Q56. Sim2Real gap 是什么？怎么缩小？

> **核心回答：** 仿真和真实世界在外观、动力学和传感上都有差异。缩小的办法是扩大仿真分布、学习忽略无关差异的表征，再用真实数据适配。

\[
P_{sim}(o,a,s')\neq P_{real}(o,a,s')
\]

视觉差异来自纹理、光照和相机，动力学差异来自摩擦、质量、执行器响应和延迟，传感差异来自噪声和标定。主要工具有 domain randomization、用系统辨识让仿真贴近真实机器人、仿真和真实数据联合训练，以及在线适配隐式的动力学估计。

## 22. 中文版：强化学习与后训练

#### Q57. PPO 是什么？写出 clip 目标。

> **核心回答：** PPO 是 on-policy 的策略梯度方法，限制每次更新让策略偏离采集数据的旧策略太远。

\[
L^{CLIP}=\mathbb E\left[\min\left(r_tA_t,\ \mathrm{clip}(r_t,1-\epsilon,1+\epsilon)A_t\right)\right],
\qquad r_t=\frac{\pi_\theta(a_t|s_t)}{\pi_{\theta_{old}}(a_t|s_t)}
\]

概率比在 advantage 有利的方向上超出 \([1-\epsilon,1+\epsilon]\) 后，目标函数就不再奖励继续变化，所以一个 batch 没法把策略推得太远。PPO 先采一批数据，做几轮 minibatch 更新，然后重新采数据。 [^ppo]

#### Q58. GAE 做了什么？

> **核心回答：** GAE 把 advantage 估计成 TD 误差的指数加权和，用 \(\lambda\) 在偏差和方差之间权衡。

\[
\delta_t=r_t+\gamma V(s_{t+1})-V(s_t),\qquad
A_t=\sum_{l\ge 0}(\gamma\lambda)^l\,\delta_{t+l}
\]

\(\lambda=0\) 时就是一步 TD 误差，方差小，但带有价值估计的偏差。\(\lambda=1\) 时变成蒙特卡洛回报减去 baseline，无偏但噪声大。常用值在 `0.95` 左右。 [^gae]

#### Q59. GRPO 是什么？和 PPO 有什么区别？

> **核心回答：** GRPO 去掉了价值网络。它对同一个输入采样一组输出，把每个输出的奖励在组内归一化后作为 advantage。 [^grpo]

Advantage 就是奖励减去组内均值再除以组内标准差，同时保留 PPO 式的 clip 概率比和指向参考模型的 KL 惩罚。这样省掉了 critic 的显存开销和不稳定性，适合稀疏的结果奖励。在机器人上它要求能多次重置到同一个初始状态，仿真里容易，真实世界很难。

#### Q60. PPO、SAC、TD3 怎么选？Replay buffer 和 offline RL 是什么？

> **核心回答：** PPO 是 on-policy，旧数据用完就丢。SAC 和 TD3 是 off-policy，从 replay buffer 里反复利用旧数据。Offline RL 只从固定数据集学习，不再和环境交互。

\[
\text{Environment}\rightarrow\text{Replay Buffer}\rightarrow\text{Training}\rightarrow\text{Environment}
\]

| 方法 | 数据 | 策略 | 关键思想 |
|---|---|---|---|
| PPO | 新鲜的 on-policy 数据 | 随机 | clip 概率比，限制更新幅度 [^ppo] |
| SAC | Replay buffer | 随机 | 最大化奖励加熵，鼓励探索 [^sac] |
| TD3 | Replay buffer | 确定性 | 双 critic、延迟 actor 更新、目标平滑 [^td3] |
| Offline RL，如 IQL、CQL | 固定数据集 | 都可以 | 贴近数据，避免高估没见过的动作 |

Replay buffer 存储由状态、动作、奖励和下一状态组成的 transition，让每次真实交互都能被多次用于更新。仿真便宜、可以大规模并行时用 PPO，比如 locomotion。真实样本昂贵时用 off-policy 方法。

#### Q61. 为什么对 VLA 做 RL 微调很难？主要有哪些做法？

> **核心回答：** 奖励稀疏，真实环境重置又慢又不安全，而 diffusion 或 flow policy 没有便宜的动作似然可供策略梯度使用。

- **Token 类 VLA：** 直接在 action token 概率上做 PPO 或 GRPO，通常在仿真里进行。
- **Flow 或 diffusion policy：** 把去噪链改成每一步都是高斯分布的随机过程，让每一步都有似然，Flow-GRPO 在图像模型上就是这么做的。 [^flow-grpo] 也可以只学一个小的残差 policy，或者学一个作用在初始噪声上的 policy，而不更新整个模型。
- **人在回路的 off-policy RL：** HIL-SERL 结合示教、人工干预和 off-policy RL，在真实机器人上达到了很高的成功率。 [^hil-serl]
- **Advantage-conditioned 训练：** 先学价值函数，把每段数据标成好或差，再以这个标签为条件训练 policy。π*0.6 的 RECAP 方法就是这样做的，它结合了示教、自主经验和专家纠正。 [^recap]

#### Q62. 真实机器人 RL 的奖励从哪里来？

> **核心回答：** 通常来自学出来的成功分类器或 VLM 评判，因为人工设计的奖励需要真实机器人测不到的状态。

最常见的是用几百张标注图像训练一个二值成功检测器。VLM 奖励能跨任务泛化，但可能有噪声，也容易被钻空子。进度估计器能给出更稠密的信号。Reward hacking 是真实存在的风险，一定要亲眼检查 rollout。

## 23. 中文版：控制与部署

#### Q63. 3 Hz 的 VLA 怎么驱动 50 Hz 甚至更高频的控制器？

> **核心回答：** 用分层结构。VLA 低频输出 chunk 或目标，底层控制器高频地带反馈跟踪。

\[
\text{VLA}\rightarrow\text{Target or Trajectory}\rightarrow\text{OSC, MPC, or Impedance Controller}\rightarrow\text{Motor Command}
\]

```text
VLA          3 到 10 Hz       图像 + 指令        ->  action chunk 或目标位姿
Chunk 队列   每个控制周期      插值              ->  下一个设定点
控制器       50 到 1000 Hz    PD、阻抗、OSC      ->  关节力矩
```

VLA 负责语义和短时规划，控制器负责稳定性和接触安全。Chunking 和异步执行让机器人在两次 VLA 调用之间持续运动。

#### Q64. PD 控制、IK、阻抗控制、OSC、MPC 分别是什么？

> **核心回答：** 它们是把目标转换成电机指令的标准底层工具。

- **PD 控制：** 力矩由位置误差项和速度误差项相加得到，是最简单的跟踪控制器。
- **IK：** 计算让末端到达目标位姿的关节角。
- **阻抗控制：** 让机械臂在目标附近表现得像弹簧加阻尼，接触时柔顺又安全。
- **OSC：** 利用机器人动力学模型，直接在任务空间控制末端运动。
- **MPC：** 每个控制周期都求解一个带约束的短时域优化问题。

#### Q65. 机械臂为什么会抖？怎么解决？

> **核心回答：** 抖动来自相邻预测不一致、感知噪声、增益过激或者延迟不稳定。

可以用 action chunking 配合 temporal ensembling 或平滑的 chunk 切换，加低通滤波和速度、加速度限幅，训练时对相邻动作加平滑惩罚，调软阻抗增益，并让控制回路以固定频率运行，不受推理耗时影响。

#### Q66. 怎么降低 VLA 推理延迟？

> **核心回答：** 减 token，减步数，优化运行时。

减少视觉 token，缓存观测前缀，减少 flow 或 diffusion 步数或者蒸馏成少步模型，用并行输出 chunk 代替长自回归解码。运行时层面用 BF16 或量化、TensorRT、`torch.compile` 和 CUDA Graphs。剩下的延迟用异步执行来掩盖。

#### Q67. ONNX、TensorRT、Triton 怎么区分？

> **核心回答：** ONNX 是模型交换格式，TensorRT 是 NVIDIA 的推理优化引擎，Triton 是服务化系统。

\[
\text{PyTorch}\rightarrow\text{ONNX}\rightarrow\text{TensorRT}\rightarrow\text{Triton Serving}
\]

TensorRT 负责层融合、kernel 选择以及 FP16 或 INT8 执行。Triton 负责请求处理、动态 batching、并发和多模型管理。典型流程是把 PyTorch 模型导出成 ONNX，构建 TensorRT engine，再用 Triton 对外提供服务。

#### Q68. INT8 量化后精度下降怎么办？

> **核心回答：** 改进校准，敏感层保留高精度，或者做量化感知训练。

用真实部署数据做校准。动作头、归一化层和激活有离群值的层保留 FP16 或 BF16。可以先只量化权重，比如 INT8 或 INT4 权重配 FP16 激活，这样更稳妥。精度仍然下降的话，再用 QAT 微调。

#### Q69. KV cache 什么时候对 VLA 有用？batching 和硬件怎么选？

> **核心回答：** 只要有逐 token 解码，或者同一个前缀被反复使用，KV cache 就有用，比如带 action expert 的迭代去噪。

自回归 VLA 缓存之前 token 的 key 和 value。π0 这类 flow VLA 只计算一次图像和语言前缀，在所有去噪步里复用它的 cache。大 batch 提高吞吐但增加等待时间，所以单台机器人用 batch size 1，云端服务机器人集群时用动态 batching。GPU 的支持最成熟，端侧 NPU 更省电，但受限于算子覆盖。

## 24. 中文版：评估与调试

#### Q70. VLA 怎么评估？

> **核心回答：** 用仿真 benchmark 快速迭代，用固定协议的真机实验做最终决策，并且一定要报告不确定性。

常用 benchmark 有做多任务和长时序操作的 LIBERO、仿真结果和真机表现相关性较好的 SimplerEnv，以及做长时序语言条件任务的 CALVIN。 [^libero] [^simpler] [^calvin] 离线验证 loss 和成功率的相关性往往很差，不能替代 rollout。泛化要沿不同维度分别测试，比如新物体、新位置、光照、背景和新指令。

#### Q71. 真机测多少次才够？

> **核心回答：** 通常要比大家实际测的多。成功率是二项分布估计，次数少时误差条很宽。

真实成功率 50% 时测 20 次，95% 置信区间大约是 `±22` 个百分点。所以 20 次里一个 60%、一个 70% 的两个 policy 并不能可靠地区分。两个 policy 要用相同的初始条件，随机安排测试顺序，尽量盲测，并报告测试次数。

#### Q72. 训练时效果很好，真机却失败，怎么排查？

> **核心回答：** 先排除 pipeline 不一致，这是大多数失败的原因，然后才怀疑模型。

1. **归一化：** 部署时的动作和状态统计量和训练时一样吗？
2. **约定：** 动作坐标系、增量还是绝对、旋转格式、夹爪编码是否完全一致？
3. **相机：** 视角顺序、分辨率、裁剪、颜色通道顺序和标定是否一致？
4. **时序：** 控制频率是否一致，延迟有没有让观测过时？
5. **回放测试：** 在机器人上回放训练 episode 录下的动作。如果回放都失败，问题出在机器人接口，而不是 policy。
6. **离线检查：** 把录下的训练观测喂给部署的模型，比较输出和录下的动作。

## 25. 中文版：场景题

#### Q73. 新机器人的自由度、传感器和控制频率都不同，怎么迁移 VLA？

> **核心回答：** 对齐观测，尽量使用共享的动作接口，加一个本体专属的输出头，再用少量目标数据微调。

把相机和本体状态映射成模型期望的输入格式。预测末端动作再用 IK 转换，或者为新的关节空间加一个新动作头。把数据重采样到新的控制频率，或者调整 chunk 长度。从几百条示教起步，用 LoRA 或只训输出头来微调。

#### Q74. 长时序任务怎么处理？

> **核心回答：** 拆成子任务，由高层规划器选择下一个子任务，底层 policy 负责执行，同时检查进度。

\[
\text{Locate}\rightarrow\text{Open}\rightarrow\text{Grasp}\rightarrow\text{Place}
\]

规划器可以是单独的 VLM，也可以像 π0.5 那样由 VLA 自己预测语言子任务。 [^pi05] 每个子任务结束后做成功检测，失败时重试或执行恢复动作。当前画面看不出任务进度时，记住之前的步骤就很重要。

#### Q75. 让你从零设计一个 WAM 预训练项目，你怎么规划？

> **核心回答：** 从预训练视频模型出发，在混合视频上配一个轻量动作头做预训练，尽早做小规模消融，所有决策都以下游 policy 成功率为准。

1. **Backbone：** 预训练的视频 diffusion Transformer 及其 VAE，或者 JEPA 编码器加预测器。
2. **数据：** 大量第一视角和机器人视频，加上较少的带动作机器人数据，按 Q40 的方式统一和过滤。
3. **目标：** 未来预测和动作 loss 联合训练，视频和动作用独立的噪声强度，让模型也能单独作为 policy 运行。
4. **推理：** 预设推理时跳过显式视频生成，从第一天起就测延迟。
5. **评估：** 固定的仿真 benchmark 加一小套真机任务，消融视频联合训练、数据配比和表征选择。

#### Q76. 为什么 VLA 还需要传统控制器？

> **核心回答：** 两者解决不同时间尺度的问题。VLA 决定做什么以及大致怎么做，控制器保证稳定、安全、高频的执行。

几赫兹的 VLA 无法在毫秒级对接触力做出反应。关节限位、碰撞检查和力限制也应该放在控制器里，绝不能依赖学出来的模型。

## 26. 中文版：五层答题框架

遇到陌生问题时，先判断它属于哪一层，再从这一层作答。

| 层 | 回答的问题 | 关键词 |
|---|---|---|
| 感知 | 机器人看到了什么？ | 相机、深度、本体状态、视觉编码器 |
| 表征 | 模型保留了什么？ | 语义、几何、动力学、world model |
| 动作生成 | 动作怎么表示和采样？ | token、chunk、diffusion、flow matching |
| 控制 | 动作怎么稳定执行？ | 控制器、频率、平滑 |
| 学习与部署 | 系统怎么训练、评估和上线？ | 数据、预训练、RL、Sim2Real、推理 |

\[
\boxed{\text{Perception}\rightarrow\text{Representation}\rightarrow\text{Reasoning}\rightarrow\text{Action}\rightarrow\text{Control}}
\]

训练、适配和部署决定了每一层能否在真实机器人上落地。

## References and version notes

[^openvla]: *OpenVLA: An Open-Source Vision-Language-Action Model*. arXiv:2406.09246. First submitted June 2024. Supports the Llama 2 backbone, DINOv2 and SigLIP fusion, 256-bin action discretization between data quantiles, autoregressive action tokens, training on about 970k trajectories, and LoRA adaptation.

[^fast]: *FAST: Efficient Action Tokenization for Vision-Language-Action Models*. arXiv:2501.09747. First submitted January 2025. Supports DCT plus BPE action tokenization and π0-FAST.

[^gqa]: *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints*. arXiv:2305.13245. First submitted May 2023. Supports grouped-query attention as an interpolation between multi-head and multi-query attention.

[^flashattention]: *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness*. arXiv:2205.14135. First submitted May 2022. Supports tiled exact attention without materializing the full score matrix.

[^vae]: *Auto-Encoding Variational Bayes*. arXiv:1312.6114. First submitted December 2013. Supports the VAE objective of reconstruction plus KL regularization.

[^ddim]: *Denoising Diffusion Implicit Models*. arXiv:2010.02502. First submitted October 2020. Supports deterministic few-step sampling with a model trained by the DDPM objective.

[^cfg]: *Classifier-Free Diffusion Guidance*. arXiv:2207.12598. First submitted July 2022. Supports condition dropout during training and guided sampling that combines conditional and unconditional predictions.

[^flow-matching]: *Flow Matching for Generative Modeling*. arXiv:2210.02747. First submitted October 2022. Introduces Flow Matching as vector-field regression along chosen probability paths.

[^rotation6d]: *On the Continuity of Rotation Representations in Neural Networks*. arXiv:1812.07035. First submitted December 2018. Supports the discontinuity of rotation representations with four or fewer dimensions and the continuous 6D representation.

[^act]: *Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware*. arXiv:2304.13705. First submitted April 2023. Introduces ALOHA and Action Chunking with Transformers, including the CVAE formulation and temporal ensembling.

[^diffusion-policy]: *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*. arXiv:2303.04137. First submitted March 2023. Supports conditional action diffusion, CNN and Transformer denoisers, and receding-horizon execution.

[^rtc]: *Real-Time Execution of Action Chunking Flow Policies*. arXiv:2506.07339. First submitted June 2025. Supports Real-Time Chunking as inpainting of the next chunk during asynchronous execution.

[^rt1]: *RT-1: Robotics Transformer for Real-World Control at Scale*. arXiv:2212.06817. First submitted December 2022. Supports RT-1 as a large-scale multi-task robot Transformer with tokenized actions.

[^rt2]: *RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control*. arXiv:2307.15818. First submitted July 2023. Supports co-fine-tuning on web vision-language data and robot trajectories with actions expressed as tokens.

[^octo]: *Octo: An Open-Source Generalist Robot Policy*. arXiv:2405.12213. First submitted May 2024. Supports Octo as a Transformer policy with a diffusion head trained on 800k Open X-Embodiment trajectories.

[^oxe]: *Open X-Embodiment: Robotic Learning Datasets and RT-X Models*. arXiv:2310.08864. First submitted October 2023. Supports the pooled multi-robot dataset used for cross-embodiment training.

[^pi0]: *π0: A Vision-Language-Action Flow Model for General Robot Control*. arXiv:2410.24164. First submitted October 2024. Supports the PaliGemma backbone, the flow matching action expert, the blockwise causal attention mask, 50-step chunks, and 10 integration steps.

[^pi05]: *π0.5: a Vision-Language-Action Model with Open-World Generalization*. arXiv:2504.16054. First submitted April 2025. Supports heterogeneous co-training and high-level subtask prediction before low-level action generation.

[^ki]: *Knowledge Insulating Vision-Language-Action Models: Train Fast, Run Fast, Generalize Better*. arXiv:2505.23705. First submitted May 2025. Supports training the backbone on discrete action tokens while stopping gradients from the continuous action expert.

[^gr00t]: *GR00T N1: An Open Foundation Model for Generalist Humanoid Robots*. arXiv:2503.14734. First submitted March 2025. Supports the dual-system design, the flow matching diffusion Transformer action head, and the use of latent actions and pseudo-labels for human and synthetic video.

[^cosmos]: *Cosmos World Foundation Model Platform for Physical AI*. arXiv:2501.03575. First submitted January 2025. Supports large video world models built on learned video tokenizers.

[^dreamer]: *Mastering Diverse Domains through World Models*. arXiv:2301.04104. First submitted January 2023. Supports DreamerV3 and learning behavior from imagined latent rollouts.

[^vjepa2]: *V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning*. arXiv:2506.09985. First submitted June 2025. Supports predictive video representations and their use for robot planning.

[^openwam]: *OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining*. arXiv:2609.07398. First submitted September 2026. Supports the modular view of WAM design across representation, backbone, information flow, inference procedure, and data.

[^unipi]: *Learning Universal Policies via Text-Guided Video Generation*. arXiv:2302.00111. First submitted February 2023. Supports UniPi as video generation followed by inverse dynamics.

[^gr1]: *Unleashing Large-Scale Video Generative Pre-training for Visual Robot Manipulation*. arXiv:2312.13139. First submitted December 2023. Supports GR-1 as a GPT-style model that jointly predicts future frames and actions.

[^gr2]: *GR-2: A Generative Video-Language-Action Model with Web-Scale Knowledge for Robot Manipulation*. arXiv:2410.06158. First submitted October 2024. Supports large-scale video pre-training followed by joint video and action fine-tuning.

[^uva]: *Unified Video Action Model*. arXiv:2503.00200. First submitted March 2025. Supports a joint video and action latent with decoupled heads, masked training for several functions, and skipping video generation at inference.

[^flare]: *FLARE: Robot Learning with Implicit World Modeling*. arXiv:2505.15659. First submitted May 2025. Supports aligning policy representations with future latent observations.

[^vpp]: *Video Prediction Policy: A Generalist Robot Policy with Predictive Visual Representations*. arXiv:2412.14803. First submitted December 2024. Supports conditioning a policy on predictive features from a video diffusion model.

[^fastwam]: *Fast-WAM: Do World Action Models Need Test-time Future Imagination?* arXiv:2603.16666. First submitted March 2026. Supports the controlled comparison between video co-training and test-time future generation.

[^diffusion-forcing]: *Diffusion Forcing: Next-token Prediction Meets Full-Sequence Diffusion*. arXiv:2407.01392. First submitted July 2024. Supports training with independent per-token noise levels.

[^vpt]: *Video PreTraining (VPT): Learning to Act by Watching Unlabeled Online Videos*. arXiv:2206.11795. First submitted June 2022. Supports labeling unlabeled video with an inverse dynamics model.

[^genie]: *Genie: Generative Interactive Environments*. arXiv:2402.15391. First submitted February 2024. Supports learning discrete latent actions from unlabeled video.

[^lapa]: *Latent Action Pretraining from Videos*. arXiv:2410.11758. First submitted October 2024. Supports pretraining a VLA on latent actions and then mapping them to real robot actions.

[^dreamgen]: *DreamGen: Unlocking Generalization in Robot Learning through Video World Models*. arXiv:2505.12705. First submitted May 2025. Supports generating synthetic robot videos and labeling them with pseudo-actions.

[^zero]: *ZeRO: Memory Optimizations Toward Training Trillion Parameter Models*. arXiv:1910.02054. First submitted October 2019. Supports the 16 bytes per parameter estimate for mixed-precision Adam and the three ZeRO sharding stages.

[^umi]: *Universal Manipulation Interface: In-The-Wild Robot Teaching Without In-The-Wild Robots*. arXiv:2402.10329. First submitted February 2024. Supports handheld gripper data collection without a robot.

[^dagger]: *A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning*. arXiv:1011.0686. First submitted November 2010. Introduces DAgger for covariate shift in imitation learning.

[^causal-confusion]: *Causal Confusion in Imitation Learning*. arXiv:1905.11979. First submitted May 2019. Supports the failure mode where imitation policies rely on nuisance correlates of expert actions.

[^ppo]: *Proximal Policy Optimization Algorithms*. arXiv:1707.06347. First submitted July 2017. Supports the clipped surrogate objective and repeated minibatch optimization on fresh data.

[^gae]: *High-Dimensional Continuous Control Using Generalized Advantage Estimation*. arXiv:1506.02438. First submitted June 2015. Supports GAE as an exponentially weighted advantage estimator that trades bias against variance.

[^grpo]: *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models*. arXiv:2402.03300. First submitted February 2024. Introduces GRPO with group-normalized advantages and no value network.

[^sac]: *Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor*. arXiv:1801.01290. First submitted January 2018. Supports SAC as an off-policy maximum-entropy actor-critic method.

[^td3]: *Addressing Function Approximation Error in Actor-Critic Methods*. arXiv:1802.09477. First submitted February 2018. Supports the twin-critic, delayed-update, and target-smoothing mechanisms of TD3.

[^flow-grpo]: *Flow-GRPO: Training Flow Matching Models via Online RL*. arXiv:2505.05470. First submitted May 2025. Supports converting deterministic flow sampling into a stochastic process so that policy gradients can be applied.

[^hil-serl]: *Precise and Dexterous Robotic Manipulation via Human-in-the-Loop Reinforcement Learning*. arXiv:2410.21845. First submitted October 2024. Supports HIL-SERL and its combination of demonstrations, human corrections, and off-policy RL on real robots.

[^recap]: Physical Intelligence. *π\*0.6: a VLA That Learns From Experience*. Technical report, November 2025. Supports RECAP, which trains an advantage-conditioned policy from demonstrations, autonomous experience, and expert corrections.

[^libero]: *LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning*. arXiv:2306.03310. First submitted June 2023. Supports the LIBERO manipulation benchmark suites.

[^simpler]: *Evaluating Real-World Robot Manipulation Policies in Simulation*. arXiv:2405.05941. First submitted May 2024. Supports SimplerEnv as a simulated evaluation that correlates with real-robot performance.

[^calvin]: *CALVIN: A Benchmark for Language-Conditioned Policy Learning for Long-Horizon Robot Manipulation Tasks*. arXiv:2112.03227. First submitted December 2021. Supports the CALVIN long-horizon benchmark.
