import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { supabase, Prompt, Device } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

export default function Prompts() {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [availableDevices, setAvailableDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showCommandModal, setShowCommandModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    device_id: '',
    niche: '',
    prompts_name: '',
    prompts_data: '',
  })

  // Example prompt - loaded from supabase/prompt.txt
  const examplePrompt = `You are an intelligent and persuasive sales chatbot designed to guide parents step by step through a proven sales flow.
Your goal is to listen empathetically, build trust, create urgency, and close sales confidently using SPIN Selling, FOMO, and emotional triggers.

### Key Instructions

#### Current Stage:
This customer is currently at the *" . ($stage) . "* stage. Strictly follow the steps relevant to this stage and respond accordingly.
- *Do not skip any stages or jump to another stage* unless explicitly directed by the user.
- Use $stage to guide your responses and ensure alignment with the stage flow.

### Stage Flow:
Follow these stages step-by-step unless explicitly redirected by the user:

1. Introduction
2. Problem Identification
3. Present Alternative (2A)
   Present Solution (2B)
4. Share Testimonials
5.Build Trust with Proof
6.Create Urgency with Promotions
7.Close with Direct Question
8.Order Booking & Confirmation

### Handling Unrelated Queries:
If the user's query is unrelated to the current stage:
1. *Dynamically detect the user's intent* based on their input.
2. *Map the intent* to one of the predefined stages in the flow above.
3. *Acknowledge their query* and redirect them back to the current stage while staying empathetic.

Examples:
- User Query: "Berapakah harga produk ini?" during *Problem Identification*:
  - Response: "Saya faham anda ingin tahu harga, tetapi boleh Layla tahu cabaran utama [user] akak dahulu?"
- User Query: "Ada testimoni tak?" during *Present Solution*:
  - Response: "Layla akan tunjukkan testimoni selepas akak faham bagaimana produk ini membantu."


### Important Rules:
1. *Align with the Current Stage*:
   - Ensure all responses are relevant to the $stage.
   - Transition to the next stage only when user input matches the intent of the current stage.

2. *Avoid Repetition*:
   - Provide unique, varied responses within the same stage to keep the conversation engaging.
   - Use dynamically generated variations to ensure freshness.
  -  Must Not Repeat Response

3. *Handle Ambiguity Gracefully*:
   - If user input lacks context to proceed, guide them politely with clarifying questions:
     - Example: "Boleh kongsikan lebih lanjut apa cabaran utama yang dihadapi?"

4. *Empathy and Guidance*:
   - Acknowledge user input and guide them back to the conversation flow with understanding and encouragement.

5. *Language and Tone*:
   - Use *Bahasa Malaysia*, incorporating English for technical terms where necessary.
   - Avoid Indonesian terms and maintain a casual, relatable tone suited for Malaysian audiences.

6 *EMOJI*:
   - Do Not Use Emoji Unless For Urgency Or Greeting Only!!!!
---

7  * Do not give customers an option to reject or change their order*.
      -Always confirm the order with confidence and reassure the customer. Use urgency when needed, but never pressure them. Avoid any words that create doubt or hesitation. Keep the customer focused on completing their purchase.

### Persuasion Techniques:
1. *SPIN Selling*:
   - *Situation*: Ask questions to understand the user's context.
   - *Problem*: Highlight challenges the user is facing.
   - *Implication*: Emphasize the consequences of the problem.
   - *Need-Payoff*: Show how your solution addresses the problem.

2. *FOMO*:
   - Use scarcity and urgency to create a sense of missed opportunity.
   - Example: "Produk ini cepat habis, kak. Jangan terlepas peluang ini!"

3. *Emotional Triggers*:
   - Empathize with the user's challenges to build rapport.
   - Example: "Layla faham, kak. Cabaran [user] susah makan memang merisaukan."

---

### Formatting Guidelines:
1. *Structure*:
   - Limit responses to 2 sentences per paragraph (12–13 words max per sentence).
   - Separate paragraphs for readability.

Closing Question:
Always end with a direct and action-oriented question to guide the user to the next step:

Example: "Akak nak tahu lebih lanjut atau teruskan pesanan sekarang?"

Flow Skip
-if customer want to know about pricing - just skip flow stage and present stage Create Urgency with Promotions:


📦 Product Knowledge (EXAMA)

1 botol ada 30 biji tablet.

Tablet mudah kunyah / hisap / telan.

Kesan seawal 3 hari (ikut penyerapan individu).

Sesuai untuk kanak-kanak, remaja, dewasa & orang tua.

Bahan utama (homeopati/mineral semula jadi):

Kalsium Fosfat, Kalium Fosfat, Magnesium Fosfat, Sukrosa (tenaga pantas).

Manfaat utama: fokus, ingatan kuat, minat belajar, stabil emosi, rangsang bahasa.

💰 Harga EXAMA (Terkini)

Harga Asal: RM190/botol.

Promo Bulan Ini:

1 Botol: RM79 (Free Postage)

2 Botol: RM140 (Freegift + Free Postage)

3 Botol: RM190 (Freegift + Free Postage)

4 Botol: RM240 (Freegift + Free Postage)

Freegift (pakej 2 ke atas):

Freegift eksklusif HQ

Kupon repeat order (1 botol percuma untuk order seterusnya)

Free postage + COD

Payment:

Online transfer (beri nombor akaun hanya bila prospek minta):

Aithi Cloud SDN BHD

🐯 Maybank – 5989897897


COD seluruh Malaysia (Sabah & Sarawak termasuk).

Stage You Must Follow and Follow All Steps In Stage

1. !!Stage Introduction!!
Objective: Identify and emphasize the user's issue to create urgency and emotional awareness
"Terima kasih hubungi Layla☺️

Boleh Tahu cik tanya untuk diri sendiri ke untuk anak?"



2. !!Stage Problem Identification!!
Objective: Identify and emphasize the user's issue to create urgency and emotional awareness.

Main Problem Is :
1) Kurang Fokus
2) Lambat Bercakap/Pelat
3) Ketagih Gadget
4) Ketinggalan Dalam Pelajaran

Flow 1:
Quickly acknowledge target user and the user's problem:
"ooo untuk [user] yer, Layla kena confirm dulu masalah utama [user] ni kurang selera makan, selalu sembelit, atau kerap demam?"


Flow 2
After identifying the main problem, expand on it by emphasizing the consequences based on the specific issue:

"Owh [masalah] ya kak… ramai ibu ayah datang dengan isu sama.
Boleh tahu [user] akak umur berapa sekarang?"

Flow 3 – Expand & Scare Factor
"[user] umur [umur] sepatutnya dah [milestone ikut umur].
Tapi bila ada [masalah], kesannya besar kak—
Jiran/saudara mula compare, cikgu pun susah nak faham, [user] jadi rendah diri.

📸 Masalah:

Kurang Fokus: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/Kurang-Fokus.png

Lambat Bercakap: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/Kurang-Fokus.png

Ketagih Gajet: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/Ketagih-Gadget.png

Ketinggalan Pelajaran: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/Ketinggalan-Pelajaran.png

Akak tak risau ke kalau benda ni berlarutan, kak?"

Stage 3A – !!Stage Present Alternative!!

Instruction for AI:

Terangkan root cause.

Terangkan Maksud Neuron
Example Output: Neuron adalah sel saraf yang berfungsi sebagai "jaringan komunikasi" di otak. Mereka menghantarkan sinyal elektrik dan kimia untuk menghubungkan berbagai bagian otak, serta menghubungkan otak dengan tubuh. Neuron berperan dalam:

Perhatian & fokus → neuron di bagian otak prefrontal cortex sangat penting untuk konsentrasi dan pengendalian diri.

Pembelajaran & memori → neuron hippocampus berperan menyimpan dan mengingat informasi.

Koordinasi tubuh → neuron mengatur gerakan motorik dan respon refleks.

Emosi & motivasi → neurotransmiter yang dilepaskan neuron (dopamin, serotonin, dll.) memengaruhi mood dan semangat [user].


Jelaskan kesannya.

Beri cara alternatif percuma.

Frame → lambat, susah konsisten.

Tutup dengan hook.

Example Output – Kurang Fokus
"Masalah utama kenapa [user] kurang fokus ialah neuron otak tak cukup aktif.
Neuron ni macam kabel elektrik—bila lemah, signal jadi slow.

Kesannya, [user] mudah terganggu, cepat lupa & susah ikut rentak belajar.

Alternatif percuma 👉 ulang bacaan setiap hari & jaga waktu tidur.
Cuma cara ni makan masa lama & susah nak konsisten.

Akak nak saya share pasal vitamin & mineral khas yang bantu aktifkan neuron?"

Stage 3B – !!Stage Present Solution (EXAMA)!!

Bila Customer Jawab "nak/ya"

"EXAMA diformulasikan dengan Kalsium Fosfat, Kalium Fosfat & Magnesium Fosfat.
Mineral ni bantu aktifkan neuron → [user] lebih fokus, cepat tangkap & minat belajar.

📸 Ingredients: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/Bahan-Kandungan.jpg

Akak nak tengok testimoni [user] yang dah berubah lepas amalkan EXAMA?"

Stage 4 – !!Stage Share Testimonials!!

https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/testimoni-kurang-fokus-1.png

https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/testimoni-kurang-fokus-2.png

https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/testimoni-kurang-fokus-3.png

"Alhamdulillah, berkat ikhtiar dengan EXAMA, menunjukkan kesan yang sangat positif,  Akak nak [user] akak macam ni juga kan?"

Stage 5 – !!Stage Build Trust with Proof!!

"Kak jangan risau… EXAMA ni diluluskan KKM ✅, dibuat di kilang GMP & disahkan HALAL."

📸 KKM: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/kkm.png

📸 HALAL: https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/halal.png

"Hari ni HQ tengah buat PROMO JIMAT BERGANDA🔥🥳.
Akak nak Layla share detail promo?"


Stage 6 !!Stage Create Urgency with Promotions!!
Objective: Drive action using limited-time offers and FOMO.
Flow 1:
Important:
- Include all this image first.
Gambar : [https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/harga-1.jpg]
Gambar : [https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/harga-2.jpg]
Gambar : [https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/harga-3.jpg]

Closing Statement:
Akak booking sekarang selain dari akak dapat harga PROMO JIMAT BERGANDA ni, HQ juga akan belanja kos pos, POSTAGE PERCUMA tau🤩

Selain dari PROMO JIMAT BERGANDA ni, Harini jugak HQ umum CABUTAN BERTUAH untuk yang booking harini.

- Include this image first.
Gambar : [https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com/aqilrvsb/bonus.jpg]

kita ada HADIAH:-
Kereta Pesona 🚗,
Barang Kemas RM10,000 💎,
Cash RM1,000 💵,
Motor Honda Beat 🏍️,
Basikal Elektrik 🚲,
Scooter Elektrik 🛴,
Smart TV 📺,
Cash RM200 💵

manatahu rezeki akak kan asbab akak ambil rawatan ni🥰?

Layla suggest kalau akak nak lagi jimat, akak ambil pakej yang 2 botol kak, sebab HQ bagi HADIAH MINI RICE COOKER bernilai RM50 ringgit dengan percuma kak🥳

Dan hadiah ni LIMITED untuk yang oder harini tau.

Rugi kalau tak grab  kak.

Pembayaran akak jangan risau, kalau akak belum gaji, akak booking je dlu untukPROMO JIMAT BERGANDA ni dengan cara bagi nama dan alamat akak untuk booking hrini, gaji nanti baru HQ pos tau.

End with a compelling closing question:
Example :Akak nak booking pakej mana kak?

Stage 7 !!Stage Close with a Direct Question!!
Objective: Guide the user toward action confidently.
Flow 1:
Use warm and positive phrasing:
Example untuk pembayaran akak jangan risau tau

sebab kita ada COD, akak bayar je nanti bila barang sampai boleh kak?


Stage 8 !!Stage Objection Handling!!

Address concerns empathetically while reinforcing the value and benefits of the solution.
Flow 1:
. - Start with empathy: 'Saya faham, kak. Kadang-kadang kita nak fikir dulu.
. - Reassure with benefits: Highlight why this solution is worth the investment.
. - Use FOMO: 'Produk ni cepat habis. Jangan terlepas jimat ni, kak.
. - Offer risk reduction: 'Cuba dulu, kak. Kalau tak sesuai, kami ada jaminan.
. - End with encouragement: 'kak rasa nak cuba dulu ke? Lyla boleh bantu.


Stage 9 !!Stage Order Booking & Confirmation!!

Objective:
Simplify the process of collecting customer details and ensure accuracy while maintaining a smooth and pleasant interaction.

Step 1: Check for Existing Details
Before collecting new details, verify if the following information has already been provided:

1) Nama (Name):
If missing, ask:
Nama akak?



2) Alamat (Address):
If missing, ask:
Alamat akak?

3) No Telefon (Phone Number):
Use a default number $wa_no variable if the customer has not provided one.

Dynamic Rule:

Ask only for the missing details to avoid unnecessary repetition.
If all details are available, skip this step and move directly to confirmation



Step 2: Send Confirmation Template
If all required details are available, format the confirmation as follows:


NAMA: [Nama Pelanggan]

Target : [user]

Umur : [umur]

ALAMAT: [Alamat Lengkap]

NO FONE: [Nombor Telefon] (Jika tiada, guna variable $wa_no)

PAKEJ: [Nama Pakej dan Keterangan]

HARGA: [Harga Pakej – Contoh: RM120 + Gift]

CARA BAYARAN: [Contoh: COD atau Online Transfer]

%%NAMA: [Nama Pelanggan]

Target : [user]

Umur : [umur]

ALAMAT: [Alamat Lengkap]

NO FONE: [Nombor Telefon] (Jika tiada, guna variable $wa_no)

PAKEJ: [Nama Pakej dan Keterangan]

HARGA: [Harga Pakej – Contoh: RM120 + Gift]

CARA BAYARAN: [Contoh: COD atau Online Transfer]%%

PENGESAHAN:
Semua betul kan kak detail ni?


Key Notes:

Dynamically replace placeholders ([Nama Pelanggan], [Alamat Lengkap], etc.) with the actual user-provided data.
Ensure the confirmation message is clear and concise.


Step 3: Avoid Repetition
If the user has already confirmed their details, respond with:
Copy code
Tempahan anda sudah disahkan. Ada apa-apa lagi yang saya boleh bantu?

Update confirmation only if the user provides new or corrected information.

Step 4: Transition to the Next Stage
After confirmation, proceed to finalize the order or address any additional user inquiries.
Examples of next steps:
For COD:
Layla akan proses penghantaran dalam masa terdekat. Terima kasih tau kak.
Jika customer pilih untuk minta pos bila tarikh gaji, bagitahu HQ akan pos bila tarikh gaji yang dia pilih tu supaya customer tak risau barang sampai sebelum gaji dan dia x ada duit untuk bayar.
For Online Transfer:
Layla akan bagi detail akaun sekarang ya. Kak boleh buat bayaran dan Layla akan confirm lepas tu.
use Detail Accout given For Online Payment

Important Rules
Dynamic Tailoring:

Always ask only for the missing details.
Ensure the response feels personal and relevant.
Concise and Clear:

Use simple, friendly language.
Avoid unnecessary repetition.
Final Confirmation:

Ensure all placeholders in the confirmation template are dynamically replaced with accurate details before proceeding.`

  // Function to insert emoji at cursor position
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.prompts_data
    const before = text.substring(0, start)
    const after = text.substring(end)

    setFormData({ ...formData, prompts_data: before + emoji + after })

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length
      textarea.focus()
    }, 0)
  }

  // Function to apply text formatting
  const applyFormatting = (formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.prompts_data
    const selectedText = text.substring(start, end)

    let formattedText = ''
    let offsetEnd = 0

    switch (formatType) {
      case 'bold':
        formattedText = `**${selectedText}**`
        offsetEnd = 2
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        offsetEnd = 1
        break
      case 'underline':
        formattedText = `__${selectedText}__`
        offsetEnd = 2
        break
      case 'strikethrough':
        formattedText = `~~${selectedText}~~`
        offsetEnd = 2
        break
      case 'code':
        formattedText = `\`${selectedText}\``
        offsetEnd = 1
        break
    }

    const before = text.substring(0, start)
    const after = text.substring(end)

    setFormData({ ...formData, prompts_data: before + formattedText + after })

    // Set cursor position after formatted text
    setTimeout(() => {
      if (selectedText) {
        textarea.selectionStart = start + offsetEnd
        textarea.selectionEnd = start + offsetEnd + selectedText.length
      } else {
        textarea.selectionStart = textarea.selectionEnd = start + offsetEnd
      }
      textarea.focus()
    }, 0)
  }

  // Function to paste example prompt directly into editor
  const pasteExamplePrompt = () => {
    setFormData({ ...formData, prompts_data: examplePrompt })
    alert('Example prompt pasted into editor!')
    // Focus the textarea
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  useEffect(() => {
    loadPrompts()
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('device_setting')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDevices(data || [])
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const loadPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPrompts(data || [])
    } catch (error) {
      console.error('Error loading prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableDevices = () => {
    // Filter out devices that already have prompts
    const usedDeviceIds = prompts.map(p => p.device_id)
    return devices.filter(d => !usedDeviceIds.includes(d.device_id))
  }

  const handleAddPrompt = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      await Swal.fire({
        icon: 'error',
        title: 'Not Logged In',
        text: 'User not logged in',
      })
      return
    }

    try {
      const now = new Date().toISOString().split('T')[0] // Format: Y-m-d

      const { error } = await supabase.from('prompts').insert([
        {
          device_id: formData.device_id,
          niche: formData.niche,
          prompts_name: formData.prompts_name,
          prompts_data: formData.prompts_data,
          user_id: user.id,
          created_at: now,
          updated_at: now,
        },
      ])

      if (error) throw error

      setShowAddModal(false)
      setFormData({
        device_id: '',
        niche: '',
        prompts_name: '',
        prompts_data: '',
      })

      await Swal.fire({
        icon: 'success',
        title: 'Prompt Added!',
        text: 'Your prompt has been saved successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadPrompts()
    } catch (error: any) {
      console.error('Error adding prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Add Prompt',
        text: error.message || 'Failed to add prompt',
      })
    }
  }

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setFormData({
      device_id: prompt.device_id,
      niche: prompt.niche,
      prompts_name: prompt.prompts_name,
      prompts_data: prompt.prompts_data,
    })
    setShowEditModal(true)
  }

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingPrompt) return

    try {
      const now = new Date().toISOString().split('T')[0] // Format: Y-m-d

      const { error } = await supabase
        .from('prompts')
        .update({
          niche: formData.niche,
          prompts_name: formData.prompts_name,
          prompts_data: formData.prompts_data,
          updated_at: now,
        })
        .eq('id', editingPrompt.id)

      if (error) throw error

      setShowEditModal(false)
      setEditingPrompt(null)
      setFormData({
        device_id: '',
        niche: '',
        prompts_name: '',
        prompts_data: '',
      })

      await Swal.fire({
        icon: 'success',
        title: 'Prompt Updated!',
        text: 'Your prompt has been updated successfully.',
        timer: 2000,
        showConfirmButton: false,
      })

      loadPrompts()
    } catch (error: any) {
      console.error('Error updating prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Update Prompt',
        text: error.message || 'Failed to update prompt',
      })
    }
  }

  const handleDeletePrompt = async (prompt: Prompt) => {
    try {
      // Check if device_id exists in ai_whatsapp table
      const { data: aiWhatsappData, error: checkError } = await supabase
        .from('ai_whatsapp')
        .select('device_id')
        .eq('device_id', prompt.device_id)
        .limit(1)

      if (checkError) throw checkError

      if (aiWhatsappData && aiWhatsappData.length > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Cannot Delete',
          text: 'This prompt is being used in AI WhatsApp conversations and cannot be deleted. You can only edit it.',
        })
        return
      }

      const result = await Swal.fire({
        icon: 'warning',
        title: 'Delete Prompt?',
        text: 'Are you sure you want to delete this prompt?',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
      })

      if (result.isConfirmed) {
        const { error } = await supabase.from('prompts').delete().eq('id', prompt.id)

        if (error) throw error

        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Prompt has been deleted.',
          timer: 2000,
          showConfirmButton: false,
        })

        loadPrompts()
      }
    } catch (error: any) {
      console.error('Error deleting prompt:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Failed to Delete',
        text: error.message || 'Failed to delete prompt',
      })
    }
  }

  const openAddModal = () => {
    const available = getAvailableDevices()
    setAvailableDevices(available)
    setShowAddModal(true)
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-primary-600 mb-2">Prompts</h2>
            <p className="text-gray-600">Manage your AI prompts for each device</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 border border-blue-200"
              title="Help & Information"
            >
              <span className="text-xl">ℹ️</span>
              <span>Info</span>
            </button>
            <button
              onClick={() => setShowCommandModal(true)}
              className="bg-purple-50 hover:bg-purple-100 text-purple-600 px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 border border-purple-200"
              title="WhatsApp Commands Guide"
            >
              <span className="text-xl">⌘</span>
              <span>Commands</span>
            </button>
            <button
              onClick={openAddModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>Add Prompt</span>
            </button>
          </div>
        </div>

        {/* Prompts List */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading prompts...</div>
          </div>
        ) : prompts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Prompts Yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first prompt</p>
            <button
              onClick={openAddModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Add Your First Prompt
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{prompt.prompts_name}</h3>
                    <span className="inline-block bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded">
                      {prompt.device_id}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Niche</p>
                    <p className="text-gray-900 font-medium">{prompt.niche}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Prompt Data</p>
                    <p className="text-gray-900 text-sm line-clamp-3">{prompt.prompts_data}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <p>Created: {prompt.created_at}</p>
                    </div>
                    <div>
                      <p>Updated: {prompt.updated_at}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPrompt(prompt)}
                    className="flex-1 bg-primary-50 hover:bg-primary-600 border border-primary-200 hover:border-primary-600 text-primary-600 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(prompt)}
                    className="flex-1 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Prompt Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white w-full h-full overflow-y-auto shadow-xl p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="text-3xl font-bold text-gray-900">Add New Prompt</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pasteExamplePrompt}
                    className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                    title="Paste Example Prompt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">Paste Example</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddPrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Device ID *</label>
                  <select
                    value={formData.device_id}
                    onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a device</option>
                    {availableDevices.map((device) => (
                      <option key={device.id} value={device.device_id}>
                        {device.device_id} - {device.phone_number || 'No phone'}
                      </option>
                    ))}
                  </select>
                  {availableDevices.length === 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      All devices already have prompts assigned. Please add more devices first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Niche *</label>
                  <input
                    type="text"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Name *</label>
                  <input
                    type="text"
                    value={formData.prompts_name}
                    onChange={(e) => setFormData({ ...formData, prompts_name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Data *</label>

                    {/* Text Formatting Toolbar */}
                    <div className="bg-gray-50 border border-gray-200 rounded-t-lg p-3 mb-0">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                        <span className="text-xs font-semibold text-gray-600 mr-2">Format:</span>
                        <button
                          type="button"
                          onClick={() => applyFormatting('bold')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors font-bold"
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('italic')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors italic"
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('underline')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors underline"
                          title="Underline"
                        >
                          U
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('strikethrough')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors line-through"
                          title="Strikethrough"
                        >
                          S
                        </button>
                      </div>

                      {/* Emoji Toolbar */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-600 pt-1">Emoji:</span>
                        <div className="flex flex-wrap gap-1">
                          {['😊', '😂', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡', '😱', '🤩', '😇', '🤗', '🙏', '👍', '👎', '👏', '✌️', '🤝', '💪', '❤️', '💙', '💚', '💛', '🧡', '💜', '🔥', '✨', '⭐', '✅', '❌', '⚠️'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="text-lg hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                              title={`Insert ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={formData.prompts_data}
                    onChange={(e) => setFormData({ ...formData, prompts_data: e.target.value })}
                    className="w-full bg-white border border-gray-300 border-t-0 text-gray-900 rounded-b-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[400px] font-mono text-sm"
                    rows={20}
                    required
                    placeholder="Enter your prompt data here... Select text and use the formatting buttons above."
                  />
                  <p className="text-xs text-gray-500 mt-1">💡 Tip: Select text and click formatting buttons, or drag the bottom-right corner to resize</p>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={availableDevices.length === 0}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                      availableDevices.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    Add Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setFormData({
                        device_id: '',
                        niche: '',
                        prompts_name: '',
                        prompts_data: '',
                      })
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Prompt Modal */}
        {showEditModal && editingPrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white w-full h-full overflow-y-auto shadow-xl p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="text-3xl font-bold text-gray-900">Edit Prompt</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pasteExamplePrompt}
                    className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                    title="Paste Example Prompt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium">Paste Example</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdatePrompt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Device ID</label>
                  <input
                    type="text"
                    value={formData.device_id}
                    className="w-full bg-gray-100 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 cursor-not-allowed"
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Niche *</label>
                  <input
                    type="text"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Name *</label>
                  <input
                    type="text"
                    value={formData.prompts_name}
                    onChange={(e) => setFormData({ ...formData, prompts_name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prompt Data *</label>

                    {/* Text Formatting Toolbar */}
                    <div className="bg-gray-50 border border-gray-200 rounded-t-lg p-3 mb-0">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-300">
                        <span className="text-xs font-semibold text-gray-600 mr-2">Format:</span>
                        <button
                          type="button"
                          onClick={() => applyFormatting('bold')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors font-bold"
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('italic')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors italic"
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('underline')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors underline"
                          title="Underline"
                        >
                          U
                        </button>
                        <button
                          type="button"
                          onClick={() => applyFormatting('strikethrough')}
                          className="px-3 py-1.5 bg-white hover:bg-gray-200 border border-gray-300 rounded transition-colors line-through"
                          title="Strikethrough"
                        >
                          S
                        </button>
                      </div>

                      {/* Emoji Toolbar */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-600 pt-1">Emoji:</span>
                        <div className="flex flex-wrap gap-1">
                          {['😊', '😂', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡', '😱', '🤩', '😇', '🤗', '🙏', '👍', '👎', '👏', '✌️', '🤝', '💪', '❤️', '💙', '💚', '💛', '🧡', '💜', '🔥', '✨', '⭐', '✅', '❌', '⚠️'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="text-lg hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                              title={`Insert ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={formData.prompts_data}
                    onChange={(e) => setFormData({ ...formData, prompts_data: e.target.value })}
                    className="w-full bg-white border border-gray-300 border-t-0 text-gray-900 rounded-b-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y min-h-[400px] font-mono text-sm"
                    rows={20}
                    required
                    placeholder="Enter your prompt data here... Select text and use the formatting buttons above."
                  />
                  <p className="text-xs text-gray-500 mt-1">💡 Tip: Select text and click formatting buttons, or drag the bottom-right corner to resize</p>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Update Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingPrompt(null)
                      setFormData({
                        device_id: '',
                        niche: '',
                        prompts_name: '',
                        prompts_data: '',
                      })
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-blue-600">ℹ️</span>
                  Cara Penggunaan Prompt
                </h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 text-sm">
                {/* Section 1: Cara Panggil Value dari Contact */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-5 rounded-lg border-l-4 border-blue-500 shadow-sm">
                  <h4 className="font-bold text-blue-900 mb-3 text-base">1. Cara Panggil Value dari Contact:</h4>
                  <p className="text-blue-800 mb-3">Gunakan syntax berikut untuk auto-replace dengan data contact:</p>
                  <ul className="list-disc list-inside space-y-2 text-blue-900 ml-2">
                    <li><code className="bg-blue-200 px-2 py-1 rounded text-xs font-semibold text-blue-900">{'{{name}}'}</code> - Nama contact</li>
                    <li><code className="bg-blue-200 px-2 py-1 rounded text-xs font-semibold text-blue-900">{'{{phone}}'}</code> - Nombor telefon</li>
                    <li><code className="bg-blue-200 px-2 py-1 rounded text-xs font-semibold text-blue-900">{'{{product}}'}</code> - Nama produk</li>
                    <li><code className="bg-blue-200 px-2 py-1 rounded text-xs font-semibold text-blue-900">{'{{info}}'}</code> - Info tambahan</li>
                  </ul>
                </div>

                {/* Section 2: Cara Save Stage (Dynamic) */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-lg border-l-4 border-green-500 shadow-sm">
                  <h4 className="font-bold text-green-900 mb-3 text-base">2. Cara Save Stage (Dynamic):</h4>
                  <p className="text-green-800 mb-3">Gunakan format <code className="bg-green-200 px-2 py-1 rounded text-xs font-semibold text-green-900">!!Stage [Nama Stage]!!</code></p>
                  <div className="bg-white p-4 rounded-lg border border-green-300 font-mono text-xs text-gray-800 whitespace-pre-wrap shadow-inner">
{`!!Stage Welcome Message!!
Punpose: Greet customer
Tanya: "Assalamualaikum {{name}}, saya dari..."

!!Stage Product Offer!!
Punpose: Offer product
Tanya: "Saya ingin tawarkan {{product}}..."`}
                  </div>
                </div>

                {/* Section 3: Cara Save Details Penting */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-5 rounded-lg border-l-4 border-purple-500 shadow-sm">
                  <h4 className="font-bold text-purple-900 mb-3 text-base">3. Cara Save Details Penting:</h4>
                  <p className="text-purple-800 mb-3">Gunakan format <code className="bg-purple-200 px-2 py-1 rounded text-xs font-semibold text-purple-900">%%[label]%%</code> untuk simpan info:</p>
                  <div className="bg-white p-4 rounded-lg border border-purple-300 font-mono text-xs text-gray-800 shadow-inner">
                    Contoh: "Baik, %%customer_interest%% saya catat."
                  </div>
                </div>

                {/* Yellow Info Box */}
                <div className="bg-gradient-to-r from-yellow-100 to-amber-100 border-l-4 border-yellow-500 p-4 rounded-lg shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <p className="text-yellow-900 font-medium">
                      Sistem akan automatically detect stage, save details, dan track progress AI dalam analytics.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Command Guide Modal */}
        {showCommandModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <span className="text-purple-600">⌘</span>
                  WhatsApp Bot Commands Guide
                </h3>
                <button
                  onClick={() => setShowCommandModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Command Types */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-bold text-purple-900 mb-3 text-lg">📱 Command Types</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>Type 1 - Direct in Customer Chat:</strong> <code className="bg-white px-2 py-1 rounded">cmd</code>, <code className="bg-white px-2 py-1 rounded">dmc</code></p>
                    <p><strong>Type 2 - Customer Command:</strong> <code className="bg-white px-2 py-1 rounded">DELETE</code></p>
                    <p><strong>Type 3 - Remote Control:</strong> <code className="bg-white px-2 py-1 rounded">/phone</code>, <code className="bg-white px-2 py-1 rounded">?phone</code>, <code className="bg-white px-2 py-1 rounded">#phone</code>, <code className="bg-white px-2 py-1 rounded">%phone msg</code>, <code className="bg-white px-2 py-1 rounded">!phone</code></p>
                  </div>
                </div>

                {/* Commands Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Command</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Where to Send</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">What it Does</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Example</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">cmd</code></td>
                        <td className="border border-gray-300 px-4 py-2">Customer's chat (Business WA)</td>
                        <td className="border border-gray-300 px-4 py-2">Activate human mode</td>
                        <td className="border border-gray-300 px-4 py-2">Type in chat: <code>cmd</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">dmc</code></td>
                        <td className="border border-gray-300 px-4 py-2">Customer's chat (Business WA)</td>
                        <td className="border border-gray-300 px-4 py-2">Deactivate human mode</td>
                        <td className="border border-gray-300 px-4 py-2">Type in chat: <code>dmc</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">DELETE</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your test phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Delete test conversation</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>DELETE</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">/[phone]</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Activate human mode remotely</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>/60123456789</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">?[phone]</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Deactivate human mode remotely</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>?60123456789</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">#[phone]</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Trigger auto flow ("Teruskan")</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>#60123456789</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">%[phone] [msg]</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Send custom message via bot</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>%60123456789 Hello!</code></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2"><code className="bg-purple-50 px-2 py-1 rounded">![phone]</code></td>
                        <td className="border border-gray-300 px-4 py-2">Your phone TO Business WA</td>
                        <td className="border border-gray-300 px-4 py-2">Cancel all scheduled sequences</td>
                        <td className="border border-gray-300 px-4 py-2">Send: <code>!60123456789</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Visual Flow */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-bold text-gray-900 mb-3">📊 Visual Flow</h4>
                  <div className="space-y-4 text-sm font-mono">
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-green-600 font-bold mb-1">✅ Direct Commands (from Business WA)</p>
                      <p>Business WA → Customer Chat → Type: <code className="bg-yellow-50 px-1">cmd</code> or <code className="bg-yellow-50 px-1">dmc</code></p>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-blue-600 font-bold mb-1">✅ Testing (from Your Phone)</p>
                      <p>Your Phone → TO Business WA → Type: <code className="bg-yellow-50 px-1">DELETE</code></p>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-purple-600 font-bold mb-1">✅ Remote Control (from Your Phone)</p>
                      <p>Your Phone → TO Business WA → Type: <code className="bg-yellow-50 px-1">/phone</code>, <code className="bg-yellow-50 px-1">?phone</code>, <code className="bg-yellow-50 px-1">#phone</code>, <code className="bg-yellow-50 px-1">%phone msg</code>, <code className="bg-yellow-50 px-1">!phone</code></p>
                    </div>
                  </div>
                </div>

                {/* Key Points */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-bold text-yellow-900 mb-3">⚠️ Important Points</h4>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li><code className="bg-white px-2 py-1 rounded">cmd</code> and <code className="bg-white px-2 py-1 rounded">dmc</code> = Type directly in customer chat on Business WhatsApp</li>
                    <li><code className="bg-white px-2 py-1 rounded">/</code>, <code className="bg-white px-2 py-1 rounded">?</code>, <code className="bg-white px-2 py-1 rounded">#</code>, <code className="bg-white px-2 py-1 rounded">%</code>, <code className="bg-white px-2 py-1 rounded">!</code> = Send from YOUR phone <strong>TO</strong> Business WhatsApp number</li>
                    <li><code className="bg-white px-2 py-1 rounded">DELETE</code> = Customer (or you testing) sends TO Business WhatsApp</li>
                    <li>Remote commands must be sent <strong>TO</strong> business WhatsApp, not FROM it!</li>
                    <li>Only the connected business WhatsApp account can receive and process commands</li>
                  </ul>
                </div>

                {/* Examples */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 mb-3">💡 Quick Examples</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold mb-1">Scenario: Take over conversation manually</p>
                      <p className="bg-white p-2 rounded border border-gray-200">
                        1. Open Business WA → Customer chat<br/>
                        2. Type: <code className="bg-yellow-50 px-1">cmd</code><br/>
                        3. Reply manually<br/>
                        4. When done, type: <code className="bg-yellow-50 px-1">dmc</code>
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Scenario: Control customer remotely</p>
                      <p className="bg-white p-2 rounded border border-gray-200">
                        1. From YOUR phone<br/>
                        2. Send TO Business WA: <code className="bg-yellow-50 px-1">/60123456789</code><br/>
                        3. Customer is now in human mode<br/>
                        4. Open Business WA to reply
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Scenario: Trigger follow-up</p>
                      <p className="bg-white p-2 rounded border border-gray-200">
                        From YOUR phone, send TO Business WA:<br/>
                        <code className="bg-yellow-50 px-1">#60123456789</code><br/>
                        → Bot sends "Teruskan" to customer
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCommandModal(false)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
